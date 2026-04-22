# Sentiment & Performance Research

## Overview
This repository contains a local-first interactive dashboard built to explore the relationship between trader performance (Hyperliquid) and market sentiment (Bitcoin Fear & Greed Index). 

Rather than a static Jupyter Notebook, this submission is built as a dynamic React application. It allows the evaluator to upload the provided datasets and immediately interact with the distributions, PnL metrics, and sentiment regimes in real-time, without needing to configure a local Python environment.

## Key Features
* **Client-Side Processing**: All data parsing and aggregation runs locally in the browser using `papaparse`. No proprietary trading data is sent to external servers.
* **Sentiment Regime Analysis**: Correlates individual trade execution times with historical Fear & Greed classifications to determine if traders have an edge in specific market conditions.
* **Leverage & Risk Profiling**: Groups trades by leverage buckets (1-5x, 5-10x, 10-20x, 20x+) to analyze risk-adjusted returns and win rates.
* **Power-Law Distribution**: Isolates top-performing accounts and symbols to identify where the majority of positive PnL is generated.
* **Automated Insights**: Generates narrative findings based on the specific variables within the uploaded datasets.

## Data Requirements
The dashboard expects two CSV files. The parsing logic is robust and case-insensitive, but expects the following core columns to be present:

**1. Hyperliquid Trader Data (CSV)**
* `time` or `Timestamp IST` / `date`: Execution time (Unix timestamp or ISO string).
* `closedPnL` or `Closed PnL`: The realized profit or loss for the trade.
* `size` or `Size Tokens`: The size of the position.
* `execution price` or `Execution Price`: The fill price of the order.
* `leverage`: The leverage used (defaults to 1 if missing).
* `side`: BUY or SELL / Long or Short.
* `symbol` or `Coin`: The traded asset.
* `account` or `Account`: The unique wallet address or trader ID.

**2. Fear & Greed Index (CSV)**
* `date` or `timestamp`: The date of the sentiment reading.
* `classification`: String value (e.g., "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed").
* `value`: Integer (0-100) representing the index score.

## Technical Stack
* **React**: Core UI framework.
* **Recharts**: For rendering performance and distribution visualizations.
* **Papaparse**: For fast, browser-based CSV parsing.

## Installation & Setup

To run this application locally, ensure you have Node.js installed on your machine.

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
```
*(Note: If you are setting this up manually in a new React environment, ensure you install `papaparse` and `recharts` via `npm install papaparse recharts`)*

3. Start the development server:
```bash
npm start
```

4. Open `http://localhost:3000` in your browser.

## Usage Instructions for Evaluators
1. Upon loading the application, you will see two dropzones.
2. Drag and drop the `historical_data.csv` into the top dropzone.
3. Drag and drop the `fear_greed_index.csv` into the bottom dropzone.
4. The dashboard will automatically parse, align the timestamps, and generate the analysis across the 6 available tabs.

## Methodological Notes
* **Timestamp Alignment**: The application cleans and normalizes Unix timestamps (both seconds and milliseconds) and standard date strings to align the Hyperliquid execution data with the daily Fear & Greed index readings.
* **Missing Data**: Trades lacking valid execution times or PnL figures are safely ignored during the aggregation phase to prevent `NaN` exceptions in the visualizations.
* **Performance**: The `useMemo` hook is heavily utilized to ensure that the complex aggregation math (calculating regime win rates, cumulative timelines, and account grouping) only runs once upon file upload, ensuring a smooth UI experience thereafter.
