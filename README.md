# Research Atlas
**The deployed page is not available due to the expiration of Google Cloud instance. Please view the explanatory video instead.**

## Video


https://github.com/TokuyuSou/Research-atlas/assets/115636495/e89009aa-117e-4487-b80a-2effdebd884a



## Overview

Research Atlas is a visualization system developed by Team AtlasIntellect, designed to showcase the 
distribution and impact of academic research funding, specifically the Japanese government's KAKEN grants. 
This tool enables users to visualize the allocation of research funds across different fields and institutions, 
and correlate these with academic outputs such as published papers and citation counts.

## Features

- **Dynamic Visualization**: Users encounter an initial screen displaying bubbles representing the amount allocated to each research field. 
  The bubble's position indicates the number of papers published and their citation count.
- **Comparative Analysis**: The system facilitates easy comparison of funding distribution over time, between fields, and across research institutions.
- **Comprehensive Data**: Incorporates data on research grants and academic publications, including citation counts.
- **Interactive Design**: Includes features like scatter plots, Sankey diagrams, and word clouds to enhance user engagement and understanding.

## Data Sources

- **KAKEN Database**: Utilized for research grant data.
- **CrossRef Search Public Data**: Employed for academic paper metadata and citation counts.
- **Google Scholar**: Scraped for additional academic publication data.

## Technology

- **Data Visualization**: Implemented using D3.js, with custom modifications for unique visual representations like the Sankey diagram.
- **Data Collection**: Automated scraping from Google Scholar and API usage from KAKEN and Crossref.
- **User Interface**: Interactive components developed with jQuery UI and d3-layout-cloud for word clouds.

## Installation

1. Clone the GitHub repository.
2. Download the dataset from the provided [Google Drive link](https://drive.google.com/drive/folders/1MHRA1DkulvXe1EZAPFwz-qA2zRGHrDv9?usp=sharing) and place it in the `data/` directory of the cloned repository.
3. Run a local web server (e.g., using `python3 -m http.server 8080`) and navigate to `http://localhost:8080` in a web browser.

## Contributing

The project was collaboratively developed by Team AtlasIntellect, comprising members with roles in data collection, 
UI/UX design, and system implementation. For detailed contributions, please refer to the project document.

## Development Team Members
- Seio Inoue @sei0o
- Tokuyu Sou(Deyu Cao) @TokuyuSou
- Soshi Takeuchi @soshi-takeuchi

## Known Issues & Support

- The system is deployed experimentally at https://tokuyusou.github.io/Research-atlas, but may contain bugs.
- Large dataset loading times can be significant.

For more information or to report issues, please refer to the project GitHub page.
