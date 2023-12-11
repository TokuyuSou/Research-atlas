function restructureData(inputData) {
    const categoryData = {};

    inputData.forEach(yearData => {
        const year = yearData.year;

        yearData.children.forEach(primaryCat => {
            primaryCat.children.forEach(secondaryCat => {
                const catName = secondaryCat.name;

                if (!categoryData[catName]) {
                    categoryData[catName] = {
                        secondary_category: catName,
                        parent_category: primaryCat.name,
                        value: [],
                        paper_count: [],
                        citation_count: []
                    };
                }

                categoryData[catName].value.push([year, secondaryCat.value]);
                categoryData[catName].paper_count.push([year, secondaryCat.paper_count]);
                categoryData[catName].citation_count.push([year, secondaryCat.citation_count]);
            });
        });
    });

    // 各カテゴリーのデータを年でソート
    Object.values(categoryData).forEach(catData => {
        catData.value.sort((a, b) => a[0] - b[0]); // valueを年でソート
        catData.paper_count.sort((a, b) => a[0] - b[0]); // paper_countを年でソート
        catData.citation_count.sort((a, b) => a[0] - b[0]); // citation_countを年でソート
    });

    return Object.values(categoryData);
}


const fs = require('fs');
const path = require('path');

//ここのパラメータを必要に応じて変えてください
start_year = "2018"
end_year = "2021"
category = "baseA" //英語名で入力してください
input_file_paths = []
output_file_path = path.join(__dirname, `../data/restructured_data_${category}_.json`);

for (let i = Number(start_year); i <= Number(end_year); i++) {
    input_file_paths.push(path.join(__dirname, `../data/hierarchy_data_${category}_${i}.json`));
}


const dataFilePaths = input_file_paths;

let allYearsData = [];

dataFilePaths.forEach(filePath => {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('File read failed:', err);
            return;
        }

        try {
            const yearData = JSON.parse(data);
            allYearsData.push(yearData);

            // 全てのファイルを読み込んだ後に処理を行う
            if (allYearsData.length === dataFilePaths.length) {
                const result = restructureData(allYearsData);

                // 必要に応じて結果をファイルに書き込む
                fs.writeFile(output_file_path, JSON.stringify(result, null, 2), 'utf8', (err) => {
                    if (err) {
                        console.error('Failed to write to file:', err);
                    } else {
                        console.log(`Restructured data was written successfully to ${output_file_path}`);
                    }
                });
            }
        } catch (err) {
            console.error('Error parsing JSON string:', err);
        }
    });
});
