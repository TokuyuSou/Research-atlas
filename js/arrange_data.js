const fs = require('fs');
const path = require('path');

//ここのパラメータを必要に応じて変えてください
start_year = "2018"
end_year = "2021"
category = "baseA" //英語名で入力してください
input_file_paths = []
output_file_paths = []

for (let i = Number(start_year); i <= Number(end_year); i++) {
    input_file_paths.push(path.join(__dirname, `../data/output_${category}_${i}_with_citation.json`));
}
for (let i = Number(start_year); i <= Number(end_year); i++) {
    output_file_paths.push(path.join(__dirname, `../data/hierarchy_data_${category}_${i}.json`));
}

for (let i = 0; i < input_file_paths.length; i++) {
    const inputFile = input_file_paths[i];
    const outputFile = output_file_paths[i];
    // ファイルを読み込む
    fs.readFile(inputFile, 'utf8', (err, data) => {
        if (err) {
            console.error('File read failed:', err);
            return;
        }

        try {
            // JSONとして解析
            const projects = JSON.parse(data);

            // ヒエラルキー構造の生成
            const hierarchy = buildHierarchy(Number(start_year) + i, projects);

            // 新しいJSONファイルに書き込む
            fs.writeFile(outputFile, JSON.stringify(hierarchy, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Failed to write to file:', err);
                } else {
                    console.log(`Hierarchy data was written successfully to ${outputFile}`);
                }
            });

        } catch (err) {
            console.error('Error parsing JSON string:', err);
        }
    });
}
function buildHierarchy(year, data) {
    let root = {
        year: year,
        name: "root",
        value: 0,
        paper_count: 0,
        citation_count: 0,
        children: []
    };

    data.forEach(item => {
        root.value += item.Overall_Award_Amount;
        root.paper_count += item.products.length;
        root.citation_count += item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0);
        let primaryIndex = root.children.findIndex(c => c.name === item.Primary_Review_Section);
        let primaryChild;

        if (primaryIndex === -1) {
            primaryChild = {
                name: item.Primary_Review_Section,
                value: item.Overall_Award_Amount,
                paper_count: item.products.length,
                citation_count: item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0),
                children: []
            };
            root.children.push(primaryChild);
        } else {
            primaryChild = root.children[primaryIndex];
            primaryChild.value += item.Overall_Award_Amount;
            primaryChild.paper_count += item.products.length;
            primaryChild.citation_count += item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0);
        }

        let secondaryChild;
        if (item.Secondary_Review_Section && item.Secondary_Review_Section !== "N/A") {
            secondaryChild = primaryChild.children.find(c => c.name === item.Secondary_Review_Section);
            if (!secondaryChild) {
                secondaryChild = {
                    name: item.Secondary_Review_Section,
                    value: item.Overall_Award_Amount,
                    paper_count: item.products.length,
                    citation_count: item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0),
                    children: []
                };
                primaryChild.children.push(secondaryChild);
            } else {
                secondaryChild.value += item.Overall_Award_Amount;
                secondaryChild.paper_count += item.products.length;
                secondaryChild.citation_count += item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0);
            }
        }

        let tertiaryChild;
        if (secondaryChild && item.Tertiary_Review_Section && item.Tertiary_Review_Section !== "N/A") {
            tertiaryChild = secondaryChild.children.find(c => c.name === item.Tertiary_Review_Section);
            if (!tertiaryChild) {
                tertiaryChild = {
                    name: item.Tertiary_Review_Section,
                    value: item.Overall_Award_Amount,
                    paper_count: item.products.length,
                    citation_count: item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0),
                    children: []
                };
                secondaryChild.children.push(tertiaryChild);
            } else {
                tertiaryChild.value += item.Overall_Award_Amount;
                tertiaryChild.paper_count += item.products.length;
                tertiaryChild.citation_count += item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0);
            }
        }

        // 研究課題の追加
        if (tertiaryChild) {
            tertiaryChild.children.push({
                name: item.Title,
                value: item.Overall_Award_Amount,
                paper_count: item.products.length,
                citation_count: item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0)
            });
        } else if (secondaryChild) {
            secondaryChild.children.push({
                name: item.Title,
                value: item.Overall_Award_Amount,
                paper_count: item.products.length,
                citation_count: item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0)
            });
        } else {
            primaryChild.children.push({
                name: item.Title,
                value: item.Overall_Award_Amount,
                paper_count: item.products.length,
                citation_count: item.products.reduce((sum, product) => sum + (product.citation_count || 0), 0)
            });
        }
    });

    return root;
}

