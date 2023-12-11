/**
 * data を読み込む関数
 */
const getData = async () => {
    const data = await d3.json("data/restructured_data_baseA_.json");

    // もし，読み込んだデータを加工したい場合は，ここで行う
    return data;
};

const aggregateDataByRegion = (categories) => {
    const regionData = {};
    categories.forEach((category) => {
        const incomeDataMap = new Map(category.paper_count.map(d => [d[0], d[1]]));
        const populationDataMap = new Map(category.value.map(d => [d[0], d[1]]));
        const lifeExpectancyDataMap = new Map(category.citation_count.map(d => [d[0], d[1]]));

        category.paper_count.forEach((incomeData) => {
            const year = incomeData[0];
            const paper_count = incomeData[1];

            if (!populationDataMap.has(year) || !lifeExpectancyDataMap.has(year)) {
                return; // この年のデータをスキップ
            }

            const value = populationDataMap.get(year);
            const citation_count = lifeExpectancyDataMap.get(year);

            if (!regionData[category.parent_category]) {
                regionData[category.parent_category] = {};
            }
            if (!regionData[category.parent_category][year]) {
                regionData[category.parent_category][year] = { totalPopulation: 0, weightedIncome: 0, weightedLife: 0 };
            }
            regionData[category.parent_category][year].totalPopulation += value;
            regionData[category.parent_category][year].weightedIncome += paper_count * value;
            regionData[category.parent_category][year].weightedLife += citation_count * value;
        });
    });

    // 各年ごとに加重平均を計算
    Object.keys(regionData).forEach((parent_category) => {
        Object.keys(regionData[parent_category]).forEach((year) => {
            const data = regionData[parent_category][year];
            data.weightedIncome = data.weightedIncome / data.totalPopulation;
            data.weightedLife = data.weightedLife / data.totalPopulation;
        });
    });

    return regionData;
};









/**
 * グラフを描画する関数
 */
const createGraphs = (categories, byRegion) => {
    //
    // based on Hans Rosling's presentation and Mike Bostock's D3 example
    // http://www.ted.com/talks/hans_rosling_shows_the_best_stats_you_ve_ever_seen
    // http://bost.ocks.org/mike/categories/
    //

    d3.select("body").select("svg").remove();

    const width = 1000;
    const height = 600;
    const offset = 10;
    let currentYear = 2018;
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const tooltip = d3.select("body").append("div").style("position", "absolute").style("z-index", 10)
        .attr("class", "tooltip")
        .style("opacity", 0);

    const globalGraphDiv = d3.select("#globalGraph");
    globalGraphDiv.selectAll("svg").remove();
    const svg = globalGraphDiv.append("svg").attr("width", width + 2 * offset).attr("height", height + 2 * offset);

    /*
    const svg = d3
        .select("body")
        .append("svg")
        .attr("width", width + 2 * offset)
        .attr("height", height + 2 * offset);
    */

    svg.append("text")
        .attr("class", "incomeLabel")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + offset - 10)
        .text("Number of papers published");

    svg.append("text")
        .attr("class", "lifeLabel")
        .attr("text-anchor", "end")
        .attr("x", -10)
        .attr("y", offset + 10)
        .attr("transform", "rotate(-90)")
        .text("Total number of citations");

    const yearLabel = svg
        .append("text")
        .attr("class", "yearLabel")
        .attr("text-anchor", "end")
        .attr("font-size", 50)
        .attr("x", width - 20)
        .attr("y", height - 40)
        .text(currentYear);

    const incomeScale = d3.scaleLinear().domain([1, 1000]).range([10, width]);
    const lifeScale = d3.scaleLinear().domain([0, 5000]).range([height, 10]);
    const populationScale = d3.scaleSqrt().domain([0, 1e9]).range([1, 50]);

    const incomeAxis = d3.axisBottom(incomeScale).ticks(10, d3.format(",d"));
    const lifeAxis = d3.axisLeft(lifeScale);

    // 関数を定義
    const bisect = d3.bisector((d) => d[0]);
    const order = (a, b) => b.value - a.value;

    const position = (p) => {
        p.attr("cx", (d) => incomeScale(d.paper_count))
            .attr("cy", (d) => lifeScale(d.citation_count))
            .attr("r", (d) => populationScale(d.value));
    };

    const interpolateValues = (values, year) => {

        const i = bisect.left(values, year, 0, values.length - 1);
        const a = values[i];

        if (i > 0) {
            const b = values[i - 1];
            const t = (year - a[0]) / (b[0] - a[0]);
            return Math.round(a[1] * (1 - t) + b[1] * t);
        }

        return a[1];
    };

    /*
    const interpolateData = () => {
        return categories.map((d) => ({
            name: d.secondary_category,
            parent_category: d.parent_category,
            
            paper_count: interpolateValues(d.paper_count, currentYear),
            value: interpolateValues(d.value, currentYear),
            citation_count: interpolateValues(d.citation_count, currentYear),
            
           
        }));
    };
    */

    const interpolateData = (categories, currentYear) => {
        return categories.map((d) => {
            const findYearData = (yearDataArray) => {
                const yearData = yearDataArray.find(([year,]) => year === currentYear);

                return yearData ? yearData[1] : null;
            };
            return {

                name: d.secondary_category,
                parent_category: d.parent_category,
                value: findYearData(d.value),
                paper_count: findYearData(d.paper_count),
                citation_count: findYearData(d.citation_count)
            };
        });
    };


    const interpolateRegionValues = (regionValues) => {
        // 年と値のペアの配列に変換
        const values = Object.entries(regionValues).map(([year, data]) => {
            return [parseInt(year), data];
        });

        // 年でソート
        values.sort((a, b) => a[0] - b[0]);

        // 補間
        const i = bisect.left(values, currentYear, 0, values.length - 1);
        const a = values[i];

        if (i > 0) {
            const b = values[i - 1];
            const t = (currentYear - a[0]) / (b[0] - a[0]);
            return {
                totalPopulation: Math.round(a[1].totalPopulation * (1 - t) + b[1].totalPopulation * t),
                weightedIncome: Math.round(a[1].weightedIncome * (1 - t) + b[1].weightedIncome * t),
                weightedLife: Math.round(a[1].weightedLife * (1 - t) + b[1].weightedLife * t)
            };
        }

        return a[1];
    };

    const interpolateRegionData = (regionData) => {

        return Object.keys(regionData).map(parent_category => {
            const data = interpolateRegionValues(regionData[parent_category]);
            return {
                name: parent_category,
                parent_category: parent_category,
                paper_count: data.weightedIncome,
                value: data.totalPopulation,
                citation_count: data.weightedLife
            };
        }).filter(d => d.value > 0); // 人口が0のデータを除外
    };

    const updateCircles = () => {
        // データを更新
        console.log("updated")
        let updatedData = interpolateData(categories, currentYear);

        // データをバインド
        circle = svg.selectAll("circle").data(updatedData, (d) => d.name);

        // 新しい要素を追加
        circle.enter()
            .append("circle")
            .attr("class", "circle")
            .attr("stroke", "black")
            .merge(circle) // 既存の要素と結合
            .attr("fill", d => {
                console.log(d);

                return color(d.parent_category)
            })
            .call(position)
            .sort(order)
            .on("mouseover", function (event, d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 1);
                tooltip.html(`Category: ${d.name}<br/>Total Received amount: ${d.value}`)
                    .style("left", (event.pageX + 30) + "px")
                    .style("top", (event.pageY + 30) + "px");
            })
            .on("mouseout", function () {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .on("click", (event, d) => {
                if (byRegion) {
                    redrawGraphForRegion(categories, d.parent_category, currentYear);
                }
            });

        // 不要な要素を削除
        circle.exit().remove();
    };

    //データ読み込み
    let data;
    const regionData = aggregateDataByRegion(categories);
    if (byRegion) {
        data = interpolateRegionData(regionData);

    } else {
        data = interpolateData(categories, currentYear);
    }


    svg.append("g")
        .attr("class", "incomeAxis")
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("transform", "translate(0," + (height - offset) + ")")
        .call(incomeAxis);
    svg.append("g")
        .attr("class", "lifeAxis")
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("transform", "translate(" + offset + ",0)")
        .call(lifeAxis);

    svg.selectAll("g")
        .selectAll("text")
        .attr("fill", "black")
        .attr("stroke", "none");

    let circle = svg
        .selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "circle")
        .attr("fill", d => color(d.parent_category))
        .attr("stroke", "black")
        .call(position)
        .sort(order)
        .on("mouseover", function (event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(`Country: ${d.name}<br/>Population: ${d.value}`)
                .style("left", (event.pageX + 30) + "px")
                .style("top", (event.pageY + 30) + "px");
        })
        .on("mouseout", function (d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", (event, d) => {
            if (byRegion) {
                redrawGraphForRegion(categories, d.parent_category, currentYear);
            }
        });



    let drag_delta;
    const drag_threshold = 2;
    const dragStarted = () => {
        drag_delta = 0;
    };
    const dragged = (event) => {
        drag_delta += event.dx;
        year_delta = Math.floor(drag_delta / drag_threshold);
        if (year_delta != 0) {
            nextYear = currentYear + year_delta;
            if (nextYear < 2018) nextYear = 2018;
            else if (nextYear > 2022) nextYear = 2022;
            currentYear = nextYear;
            yearLabel.text(currentYear);

            // 新しい年に基づいてデータを更新
            if (byRegion) {
                data = interpolateRegionData(regionData);




            } else {
                updateCircles();


            }
            /*
            // circle 要素に新しいデータをバインド
            circle = circle.data(data, (d) => d.secondary_category);

            // circle 要素の位置を更新
            circle
                .call(position)
                .sort(order);
            */
            drag_delta = 0;
        }
    };

    const dragEnded = () => { };

    svg.call(
        d3
            .drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded)
    );



}

// 地域に属する国々のデータでグラフを再描画する関数
// const redrawGraphForRegion = (categories, parent_categoy_name, year) => {

//     const bisect = d3.bisector((d) => d[0]);
//     const order = (a, b) => b.value - a.value;
//     const color = d3.scaleOrdinal(d3.schemeCategory10);

//     const position = (p) => {
//         p.attr("cx", (d) => incomeScale(d.paper_count))
//             .attr("cy", (d) => lifeScale(d.citation_count))
//             .attr("r", (d) => populationScale(d.value));
//     };

//     console.log("event handler called")
//     const filteredNations = categories.filter(d => d.parent_category === parent_categoy_name);

//     // 右側のセクションの SVG をクリア
//     const regionGraphDiv = d3.select("#regionGraph");
//     regionGraphDiv.selectAll("svg").remove();

//     // 新しい SVG を作成
//     const svg = regionGraphDiv.append("svg")
//         .attr("width", 500)
//         .attr("height", 600);

//     /*
//     const yearLabel = svg
//         .append("text")
//         .attr("class", "yearLabel")
//         .attr("text-anchor", "end")
//         .attr("font-size", 50)
//         .attr("x", width)
//         .attr("y", height - 35)
//         .text(currentYear);
//     */

//     // 軸とスケールの設定
//     const incomeScale = d3.scaleLog().domain([100, 10000]).range([0, 500]);
//     const lifeScale = d3.scaleLinear().domain([0, 2000]).range([600, 0]);
//     const populationScale = d3.scaleSqrt().domain([0, 1e9]).range([1, 50]);

//     const incomeAxis = d3.axisBottom(incomeScale).ticks(5, d3.format(",d"));
//     const lifeAxis = d3.axisLeft(lifeScale);

//     svg.append("g")
//         .attr("class", "incomeAxis")
//         .attr("transform", "translate(0," + (600 - 40) + ")")
//         .call(incomeAxis);
//     svg.append("g")
//         .attr("class", "lifeAxis")
//         .attr("transform", "translate(40,0)")
//         .call(lifeAxis);

//     // データ補間関数
//     const interpolateValues = (values, year) => {
//         const i = bisect.left(values, year, 0, values.length - 1);
//         const a = values[i];

//         if (i > 0) {
//             const b = values[i - 1];
//             const t = (year - a[0]) / (b[0] - a[0]);
//             return Math.round(a[1] * (1 - t) + b[1] * t);
//         }

//         return a[1];
//     };

//     // データを補間してバブルを描画
//     let currentYear = year;
//     const updateGraph = () => {
//         const data = filteredNations.map(d => ({
//             name: d.secondary_category,
//             parent_category: d.parent_category,
//             paper_count: interpolateValues(d.paper_count, currentYear),
//             value: interpolateValues(d.value, currentYear),
//             citation_count: interpolateValues(d.citation_count, currentYear),
//         }));

//         const circle = svg.selectAll("circle")
//             .data(data, d => d.name);

//         circle.enter()
//             .append("circle")
//             .attr("class", "circle")
//             .attr("fill", d => color(d.parent_category))
//             .merge(circle)
//             .call(position)
//             .sort(order);
//     };

//     updateGraph();
//     /*
//     // ここでドラッグイベントを追加して年度を変更できるようにする（オプション）
//     let drag_delta;
//     const drag_threshold = 2;
//     const dragStarted = () => {
//         drag_delta = 0;
//     };
//     const dragged = (event) => {
//         drag_delta += event.dx;
//         year_delta = Math.floor(drag_delta / drag_threshold);
//         if (year_delta != 0) {
//             nextYear = currentYear + year_delta;
//             if (nextYear < 1800) nextYear = 1800;
//             else if (nextYear > 2009) nextYear = 2009;
//             currentYear = nextYear;
//             yearLabel.text(currentYear);

//             // 新しい年に基づいてデータを更新
//             if (byRegion) {
//                 data = interpolateRegionData(regionData);



//             } else {
//                 data = interpolateData();
//             }

//             // circle 要素に新しいデータをバインド
//             circle = circle.data(data, (d) => d.secondary_category);

//             // circle 要素の位置を更新
//             circle
//                 .call(position)
//                 .sort(order);

//             drag_delta = 0;
//         }
//     };

//     const dragEnded = () => { };

//     svg.call(
//         d3
//             .drag()
//             .on("start", dragStarted)
//             .on("drag", dragged)
//             .on("end", dragEnded)
//     );
//     // ...
//     */
// };







// createGraphs 関数と main 関数は変更なし

/**
 * main 関数
 * 読み込み時一度だけ実行される
 */

let byRegion = false; // 地域別表示かどうかのフラグ
const main = async () => {
    // data を読み込む
    const data = await getData();
    // data の中身を確認


    // グラフを描画する
    createGraphs(data, byRegion);

    // ボタンのクリックイベントを設定
    d3.select("#toggleView").on("click", () => {
        byRegion = !byRegion; // フラグを切り替え
        createGraphs(data, byRegion); // グラフを再描画
    });

};

main();
