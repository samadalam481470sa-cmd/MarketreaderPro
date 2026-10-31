"""Opt-in supervised learning on public time-series snapshots, never brokerage data.

The model estimates the NEXT change in an observed market probability.
It is an experimental research tool, not a claim of predictive edge.
"""
import json
import math
import os
import tempfile
import time
from pathlib import Path
from .signals import choose_backend

FEATURE_COUNT = 4

def training_examples(db, max_examples=2500):
    """Construct causal features: training target is the following observation.

    Each market is kept in time order. A single example cannot use future
    observations as features. Event settlement is not represented by this data.
    """
    items=db.execute("""SELECT source,market_id,captured_at,probability
         FROM samples ORDER BY source,market_id,captured_at""").fetchall()
    results=[]
    group=[]
    previous_key=None
    def flush(rows):
        if len(rows)<4: return
        values=[float(x[3]) for x in rows]
        for i in range(2,len(values)-1):
            p=values[i]
            delta=p-values[i-1]
            previous_delta=values[i-1]-values[i-2]
            features=[p,delta,previous_delta,1.0]
            target=max(-1.0,min(1.0,values[i+1]-p))
            results.append((int(rows[i][2]),features,target))
    for r in items:
        k=(r[0],r[1])
        if previous_key is not None and k!=previous_key:
            flush(group);group=[]
        group.append(r);previous_key=k
    if group:flush(group)
    # Bounded reproducible training set.
    return sorted(results,key=lambda item:item[0])[-max_examples:]

def _predict(weights,features):
    return sum(a*b for a,b in zip(weights,features))

def _evaluate(weights,data):
    if not data:return None
    return sum((_predict(weights,x)-y)**2 for _,x,y in data)/len(data)

def fit_cpu(data,epochs=35,rate=0.04):
    weights=[0.0]*FEATURE_COUNT
    for _ in range(epochs):
        grads=[0.0]*FEATURE_COUNT
        for _,x,target in data:
            error=_predict(weights,x)-target
            for j in range(FEATURE_COUNT):grads[j]+=2*error*x[j]
        for j in range(FEATURE_COUNT):
            weights[j]-=rate*(grads[j]/len(data)+0.002*weights[j])
    return weights

def fit_gpu(data,backend,torch,epochs=35,rate=0.04):
    device=torch.device(backend)
    # float32 works on both CUDA and Apple Metal.
    x=torch.tensor([v for _,v,_ in data],dtype=torch.float32,device=device)
    y=torch.tensor([v for _,_,v in data],dtype=torch.float32,device=device)
    weights=torch.zeros(FEATURE_COUNT,dtype=torch.float32,device=device,requires_grad=True)
    optimizer=torch.optim.SGD([weights],lr=rate)
    for _ in range(epochs):
        optimizer.zero_grad(set_to_none=True)
        prediction=x@weights
        loss=((prediction-y)**2).mean()+0.001*(weights**2).sum()
        loss.backward();optimizer.step()
    return weights.detach().cpu().tolist()

def train(db,mode="auto",min_examples=30):
    examples=training_examples(db)
    if len(examples)<min_examples:
        return {"status":"insufficient-history","examples":len(examples),"minimum":min_examples}
    # Chronological holdout; no training on held-out targets.
    boundary=max(1,int(len(examples)*0.8))
    training,validation=examples[:boundary],examples[boundary:]
    if not validation:return {"status":"insufficient-validation"}
    backend,torch=choose_backend(mode)
    weights=(fit_gpu(training,backend,torch) if backend!="cpu"
             else fit_cpu(training))
    baseline=_evaluate([0.0]*FEATURE_COUNT,validation)
    candidate=_evaluate(weights,validation)
    if not all(math.isfinite(n) for n in weights) or not math.isfinite(candidate):
        return {"status":"numerical-failure","examples":len(examples)}
    result={"status":"evaluated","backend":backend,"examples":len(examples),
            "training":len(training),"validation":len(validation),
            "baselineMSE":round(baseline,10),"modelMSE":round(candidate,10),
            "weights":[round(float(x),9) for x in weights]}
    # Do not promote a model that performs no better than a zero-change baseline.
    result["promoted"]=bool(candidate<baseline*0.99 and baseline>1e-12)
    return result

def save_result(db,result):
    db.execute("""INSERT INTO model_runs(created_at,status,backend,examples,baseline_mse,model_mse,weights_json,promoted)
       VALUES(?,?,?,?,?,?,?,?)""",(int(time.time()),result["status"],result.get("backend","none"),
       result.get("examples",0),result.get("baselineMSE"),result.get("modelMSE"),
       json.dumps(result.get("weights")) if result.get("weights") else None,
       int(bool(result.get("promoted")))))
    # Explicitly promote only models that beat the holdout baseline.
    if result.get("promoted"):
        db.execute("INSERT INTO model_state(model_name,weights_json,updated_at) VALUES('delta-v1',?,?) ON CONFLICT(model_name) DO UPDATE SET weights_json=excluded.weights_json,updated_at=excluded.updated_at",
                   (json.dumps(result["weights"]),int(time.time())))

def trained_model(db):
    row=db.execute("SELECT weights_json,updated_at FROM model_state WHERE model_name='delta-v1'").fetchone()
    if not row:return None
    weights=json.loads(row[0])
    if not isinstance(weights,list) or len(weights)!=FEATURE_COUNT or not all(isinstance(v,(float,int)) and math.isfinite(v) for v in weights):
        return None
    return {"weights":weights,"updatedAt":row[1]}

def predict_next_change(model,probabilities):
    if not model or len(probabilities)<3:return None
    last,previous,older=probabilities[-3:]
    x=[last,last-previous,previous-older,1.0]
    estimate=_predict(model["weights"],x)
    return max(-1.0,min(1.0,estimate))
