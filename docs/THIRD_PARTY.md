# Third-party open-source software

MarketreaderPro integrates `technicalindicators` as a Node dependency (rather than copying or vendoring code). Upstream: https://github.com/anandanand84/technicalindicators . Published under the MIT license, copyright its original authors. Version constraint: `^3.1.0`. Preserve upstream MIT attribution/licenses in the dependency distribution.

The integration is restricted to historical normalized public-market probabilities, deriving SMA, EMA, and RSI. Neither the library nor MarketreaderPro proves price prediction, executable quotes, investment suitability or profitable trading strategies.

The application also uses PostgreSQL (PostgreSQL License), node-postgres (MIT) and fast-xml-parser (MIT); consult the pinned installed package metadata/licenses. No third-party private financial records, bank logins or protected datasets are copied.
