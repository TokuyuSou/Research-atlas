/**
 * data を読み込む関数
 */
/*
const getData = async () => {
  const data = await d3.json("./data/data.json");
  return data;
};
*/

let allDataCache;
async function getAllData(categories, startYear, endYear) {
  const promises = categories.map(category => getData(category, startYear, endYear));
  const results = await Promise.all(promises);
  return results.flat();
}

const getData = async (researchCategory, startYear = 2003, endYear = 2023) => {
  let allData = [];

  // 指定された年度範囲でファイル名を生成
  for (let year = startYear; year <= endYear; year++) {
    const fileName = `output_${researchCategory}_${year}_with_citation.json`;

    try {
      // ファイルを読み込む
      const data = await d3.json(`/data/output_${researchCategory}_${startYear}_${endYear}/${fileName}`);

      // 各アイテムに年度情報を追加
      const updatedData = data.map(item => {
        return { ...item, year: year };
      });

      // 結合されたリストに追加
      allData = allData.concat(updatedData);
    } catch (error) {
      console.error(`Error loading file ${fileName}: ${error}`);
    }
  }

  return allData;

};

let currentPrimarySection = null;
let currentSecondarySection = null;
let currentKey = 'Primary_Review_Section';

// 現在の階層に応じてデータをフィルタリングする関数
function filterDataByCurrentSection(data, key, primarySection, secondarySection) {
  if (key === 'Primary_Review_Section') {
    return data; // 全研究分野のデータをそのまま使用
  } else if (key === 'Secondary_Review_Section') {
    return data.filter(d => d.Primary_Review_Section === primarySection);
  } else if (key === 'Tertiary_Review_Section') {
    return data.filter(d => d.Secondary_Review_Section === secondarySection);
  }
  return data;
}


const filterDataByInstitution = (data, key) => {
  let filteredData;

  // 現在の階層に応じたフィルタリング
  if (key === 'Primary_Review_Section') {
    filteredData = data; // 全研究分野のデータをそのまま使用
  } else if (key === 'Secondary_Review_Section') {
    // 現在のPrimary_Review_Sectionでフィルタリング

    filteredData = data.filter(d => d.Primary_Review_Section === currentPrimarySection);
  } else if (key === 'Tertiary_Review_Section') {
    // 現在のSecondary_Review_Sectionでフィルタリング
    filteredData = data.filter(d => d.Secondary_Review_Section === currentSecondarySection);
  }
  /*
  // Institutionキーでグループ化
  const groupedData = d3.group(filteredData, d => d.Institution);
  */
  return filteredData;
};

// 被引用件数を推定する関数
function estimateCitations(citationCountSumLog, citationCountPowSumAvg, mean, variance, paper_count) {
  //citationCountSumLog: 被引用件数の対数の合計, citationCoundPowSumAvg: 被引用件数の対数の二乗の平均
  // 事前分布のパラメータ（対数正規分布の平均と標準偏差）
  let priorMu = mean; // 先に計算された平均
  let priorSigma = variance; // 先に計算された分散


  // 観測データの平均と分散を計算
  let observedMean = citationCountSumLog / paper_count;
  let observedVariance = citationCountPowSumAvg - observedMean ** 2;
  let posteriorMu;
  // ベイズ更新を行い、新しい平均を計算
  if (observedVariance == 0 || paper_count == 0) {
    posteriorMu = priorMu;
  }
  else {
    posteriorMu = (priorMu / priorSigma ** 2 + observedMean / observedVariance * paper_count) / (1 / priorSigma ** 2 + paper_count / observedVariance);
  }

  // 推定された被引用件数（対数スケールから元のスケールに戻す）
  let estimatedCitations = Math.exp(posteriorMu) - 1;
  return estimatedCitations;
}

function calculateCitationStatistics(data) {
  // 被引用件数の対数の平均と分散を計算
  let totalLogCitationCount = 0;
  let totalSquaredLogCitationCount = 0;
  let totalPaperCount = 0;

  data.forEach(item => {
    if (item.paper_count > 0) {
      totalLogCitationCount += item.total_log_citation_count;
      totalSquaredLogCitationCount += item.avg_squared_log_citation_count * item.paper_count;
      totalPaperCount += item.paper_count;
    }
  });

  // 平均（対数スケール）を計算
  const mean = totalLogCitationCount / totalPaperCount;

  // 分散（対数スケール）を計算
  const variance = totalSquaredLogCitationCount / totalPaperCount - mean ** 2;

  console.log("totalLogCitationCount: " + totalLogCitationCount);
  console.log("totalSquaredLogCitationCount: " + totalSquaredLogCitationCount);
  console.log("totalPaperCount: " + totalPaperCount);

  return { mean, variance };
}

// ランキングを計算し、表示する関数
function displayRankings(data) {
  // 既存のランキング要素をクリア
  d3.select("#paperRanking").selectAll("div").remove();
  d3.select("#citationRanking").selectAll("div").remove();

  // projectCountが10以上のグループのみをフィルタリング
  let filteredData = data.filter(d => d.value.projects >= 10);

  // 論文数/取得額のランキング
  let paperRanking = filteredData.map(d => ({
    name: d.key,
    value: d.value.papers / d.value.fund * 10 ** 6
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  // 被引用件数/取得額のランキング
  let citationRanking = filteredData.map(d => ({
    name: d.key,
    value: d.value.score / d.value.fund * 10 ** 6
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  // 論文数ランキングを表示
  d3.select("#paperRanking").selectAll("div")
    .data(paperRanking)
    .enter()
    .append("div")
    .text(d => `${d.name}: ${d.value.toFixed(2)}`);

  // 被引用件数ランキングを表示
  d3.select("#citationRanking").selectAll("div")
    .data(citationRanking)
    .enter()
    .append("div")
    .text(d => `${d.name}: ${d.value.toFixed(2)}`);
}


/**
* グラフを描画する関数
*/
let circle;

let previousData = [];

let if_redraw_word_cloud = true;

const handleBackButtonClick = () => {
  if (previousData.length > 0) {
    const prev = previousData.pop();
    currentPrimarySection = prev.primarySection;
    currentSecondarySection = prev.secondarySection;
    currentKey = prev.key;
    createGraphs(prev.data, $("#slider-range").slider("values", 0), $("#slider-range").slider("values", 1), prev.key, prev.currentLevel);
    // document.getElementById('currentLevel').textContent = lastData.currentLevel;

  } else {
    console.error("No previous Data");
    // document.getElementById('currentLevel').textContent = '最上層です';
  }

  document.getElementById('currentLevel').textContent = breadcrumb();
};

// Attach event listener to back button
document.getElementById('backButton').addEventListener('click', handleBackButtonClick);


//データを、指定した区分でネスト化する関数
function createNestedData(data, year_start, year_end, key) {
  // Filter data for the selected year
  const filteredData = data.filter(d => d.Start_Year >= year_start && d.Start_Year <= year_end);

  // Update current level display
  document.getElementById('currentLevel').textContent = breadcrumb();

  // Group data by the specified key and calculate sum of papers, score and fund
  const groupedData = d3.group(filteredData, d => d[key]);

  console.log(groupedData);

  const nestedData = Array.from(groupedData, ([key, values]) => {
    // 各グループでの論文数と被引用件数の合計
    const totalPapers = d3.sum(values, d => Number(d.paper_count));
    const totalCitations = d3.sum(values, d => Number(d.total_citation_count));

    // 各グループでの被引用件数の対数和と対数の二乗和
    const totalLogCitationCount = d3.sum(values, d => Number(d.total_log_citation_count));
    const avgSquaredLogCitationCount = d3.sum(values, d => Number(d.avg_squared_log_citation_count));




    // 推定の被引用件数、estimatedCitationsは、単純平均、estimatedCitations2は、対数正規分布を仮定した場合のベイズ推定の結果
    // 被引用件数の推定値を計算
    const estimatedCitations = estimateCitations(
      totalLogCitationCount,
      avgSquaredLogCitationCount,
      mean,
      variance,
      totalPapers
    );
    console.log(estimatedCitations);

    // 各グループ内の研究課題の数
    const projectCount = values.length;
    return {
      key,
      value: {
        papers: totalPapers,
        citation_count: totalCitations,
        fund: d3.sum(values, d => d.Overall_Award_Amount),
        name: values[0].name,
        projects: projectCount,
        score: estimatedCitations * totalPapers


      }
    };
  });

  return nestedData;

}

// 予算規模に基づいてランキングデータをフィルタリングする関数
function filterRankingDataByBudgetRange(nestedData, range) {
  console.log(nestedData);
  // 予算規模でソート
  let sortedData = nestedData.sort((a, b) => b.value.fund - a.value.fund);

  let filteredData;
  switch (range) {
    case 'top10':
      // 予算規模上位10位の研究機関のデータをフィルタリング
      filteredData = sortedData.slice(0, 10);
      break;
    case 'top50':
      // 予算規模上位50位の研究機関のデータをフィルタリング
      filteredData = sortedData.slice(0, 50);
      break;
    default:
      // 全ての研究機関のデータを使用
      filteredData = nestedData;
      break;
  }
  return filteredData;
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MyDatabase", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore("groupData", { keyPath: "id" });
      db.createObjectStore("originalData", { keyPath: "id" });
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}


async function saveToIndexedDB(groupData) {
  const db = await openIndexedDB();
  const transaction = db.transaction(["groupData"], "readwrite");
  const store = transaction.objectStore("groupData");

  return new Promise((resolve, reject) => {
    const request = store.put({ id: "selectedGroupData", data: groupData });

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}


async function saveToIndexedDB_original_data(originalData) {
  const db = await openIndexedDB();
  const transaction = db.transaction(["originalData"], "readwrite");
  const store = transaction.objectStore("originalData");

  return new Promise((resolve, reject) => {
    const request = store.put({ id: "originalData", data: originalData });

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

const breadcrumb = (inInstitutionView = false) => {
  let ret = "";
  if (currentSecondarySection) {
    ret = `all > ${currentPrimarySection} > ${currentSecondarySection}`;
  } else if (currentPrimarySection) {
    ret = `all > ${currentPrimarySection}`;
  } else {
    ret = 'all';
  }

  if (inInstitutionView) {
    ret += ' > 機関別';
  }

  return ret;
}


const createGraphs = (data, year_start, year_end, key = 'Primary_Review_Section', currentLevel = '最上層です') => {
  if (key === 'Primary_Review_Section' || key === 'Secondary_Review_Section' || key === 'Tertiary_Review_Section') {
    currentKey = key;
  }
  d3.select('.tooltip').remove();
  d3.select("#graph-container").select("svg").remove();
  // Hide tooltip
  d3.select('.tooltip').style('opacity', 0);
  const width = document.documentElement.clientWidth * 0.6;
  const height = document.documentElement.clientHeight * 0.7;
  window.addEventListener("resize", () => {
    createGraphs(data, year_start, year_end, key, currentLevel);
  })
  const offset = 40;
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  // Filter data for the selected year
  const filteredData = data.filter(d => d.Start_Year >= year_start && d.Start_Year <= year_end);

  // Update current level display
  document.getElementById('currentLevel').textContent = breadcrumb();

  // Group data by the specified key and calculate sum of papers, score and fund
  const groupedData = d3.group(filteredData, d => d[key]);

  console.log(groupedData);

  const nestedData = Array.from(groupedData, ([key, values]) => {
    // 各グループでの論文数と被引用件数の合計
    const totalPapers = d3.sum(values, d => Number(d.paper_count));
    const totalCitations = d3.sum(values, d => Number(d.total_citation_count));

    // 各グループでの被引用件数の対数和と対数の二乗和
    const totalLogCitationCount = d3.sum(values, d => Number(d.total_log_citation_count));
    const avgSquaredLogCitationCount = d3.sum(values, d => Number(d.avg_squared_log_citation_count));




    // 推定の被引用件数、estimatedCitationsは、単純平均、estimatedCitations2は、対数正規分布を仮定した場合のベイズ推定の結果
    // 被引用件数の推定値を計算
    const estimatedCitations = estimateCitations(
      totalLogCitationCount,
      avgSquaredLogCitationCount,
      mean,
      variance,
      totalPapers
    );
    console.log(estimatedCitations);

    // 各グループ内の研究課題の数
    const projectCount = values.length;
    return {
      key,
      value: {
        papers: totalPapers,
        citation_count: totalCitations,
        fund: d3.sum(values, d => d.Overall_Award_Amount),
        name: values[0].name,
        projects: projectCount,
        score: estimatedCitations * totalPapers


      }
    };
  });

  // データが更新されるたびにランキングを表示する
  if (document.getElementById('budget-range') != null) {
    const selectedRange = document.getElementById('budget-range').value
    const filteredData_for_ranking = filterRankingDataByBudgetRange(nestedData, selectedRange);
    displayRankings(filteredData_for_ranking);
  } else {
    displayRankings(nestedData);
  }


  // Create SVG
  const svg = d3.select("#graph-container")
    .append("svg")
    .attr("width", width + 2 * offset)
    .attr("height", height + 2 * offset)
    .append("g")
    .attr("transform", "translate(" + offset + ",0)"); // Add this line


  // Add labels
  svg.append("text")
    .attr("class", "paperLabel")
    .attr("text-anchor", "end")
    .attr("x", width)
    .attr("y", height - 10)
    .text("Number of theses");

  svg.append("text")
    .attr("class", "scoreLabel")
    .attr("text-anchor", "end")
    .attr("y", 35)
    .attr("transform", "rotate(-90)")
    .text("Score(Estimated number of citations)");

  // Add scales
  // Add scales
  const fundScale = d3.scaleSqrt().domain([0, d3.max(nestedData, d => d.value.fund)]).range([1, 50]);
  const maxRadius = d3.max(nestedData, d => fundScale(d.value.fund));
  const paperScale = d3.scaleLinear().domain([0, d3.max(nestedData, d => d.value.papers) * 1.2]).range([0, width]);
  const scoreScale = d3.scaleLinear().domain([0, d3.max(nestedData, d => d.value.score) * 1.2]).range([height, 0]);

  // Add axes
  const paperAxis = d3.axisBottom(paperScale).ticks(5, d3.format(",d"));
  const scoreAxis = d3.axisLeft(scoreScale);
  svg.append("g")
    .attr("class", "paperAxis")
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("transform", "translate(20," + (height + 10) + ")")
    .call(paperAxis);
  svg.append("g")
    .attr("class", "scoreAxis")
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("transform", "translate(20,10)")
    .call(scoreAxis);


  svg.selectAll("g")
    .selectAll("text")
    .attr("fill", "black")
    .attr("stroke", "none");

  // Extract unique theme names from the data
  const themes = [...new Set(data.map(item => item.theme))];

  // Generate an array of colors
  const colors = d3.scaleOrdinal(d3.schemeCategory10).range();

  // Create color scale
  const colorScale = d3.scaleOrdinal()
    .domain(themes)
    .range(colors);

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  // defs要素を追加
  const defs = svg.append("defs");

  // 各大学のロゴに対応するパターンを定義
  const universities = [
    // ... その他の大学
  ];

  universities.forEach(univ => {
    defs.append("pattern")
      .attr("id", `pattern-${univ.name}`) // 一意のID
      .attr("width", 1)
      .attr("height", 1)
      .attr("patternContentUnits", "objectBoundingBox")
      .append("image")
      .attr("xlink:href", univ.logo) // 大学のロゴのパス
      .attr("width", 1)
      .attr("height", 1)
      .attr("preserveAspectRatio", "xMidYMid slice");
  });

  // Add circles
  circle = svg.selectAll(".circle") // Modify this line
    .data(nestedData.sort((a, b) => d3.descending(a.value.fund, b.value.fund)))
    .enter()
    .append("circle")
    .attr("class", "circle")
    .attr("fill", (d) => {
      const univ = universities.find(u => u.name === d.key);
      return univ ? `url(#pattern-${univ.name})` : colorScale(d.key);
    })
    .attr("stroke", "black")
    .attr("cx", (d) => paperScale(d.value.papers)) // Use summed values
    .attr("cy", (d) => scoreScale(d.value.score)) // Use summed values
    .attr("r", (d) => fundScale(d.value.fund)) // Use summed values
    .on('mouseover', (event, d) => {
      tooltip.transition()
        .duration(200)
        .style('opacity', .9);

      // SVG要素の現在のページにおける位置を取得
      const svgPosition = document.querySelector("#graph-container svg").getBoundingClientRect();

      // ツールチップの位置をバブルの座標に基づいて設定
      const x = svgPosition.left + window.scrollX + paperScale(d.value.papers);
      const y = svgPosition.top + window.scrollY + scoreScale(d.value.score);
      const r = fundScale(d.value.fund);

      // インタラクションの指示を追加
      let interactionInstruction = '';
      if (key === 'Tertiary_Review_Section') {
        interactionInstruction = 'クリックして、課題別詳細に移動';
      } else if (key === 'Primary_Review_Section' || key === 'Secondary_Review_Section') {
        interactionInstruction = 'ダブルクリックして、この区分の内訳を見る';
      }
      tooltip.html('Name: ' + d.key + '<br/>Fund: ' + parseFloat((d.value.fund / 10 ** 8).toFixed(0)).toLocaleString() + '億円<br/><span class="interaction-instruction">' + interactionInstruction + '</span>')
        .style("position", "absolute")
        .style('background', 'white')
        .style('left', (x + r + 40) + 'px') // バブルの右側に表示
        .style('top', (y - r / 2 - 54) + 'px'); // バブルの中心より少し上に表示

      d3.select(event.currentTarget).raise(); // ホバーしたバブルを最前面に
    })
    .on('mouseout', () => {
      tooltip.transition()
        .duration(500)
        .style('opacity', 0);
      d3.select(event.currentTarget).lower(); // ホバーが外れたバブルを元の位置に
    })

    .on('dblclick', (event, d) => {
      if_redraw_word_cloud = true;
      // Save current data to previousData
      previousData.push({ data, key, primarySection: currentPrimarySection, secondarySection: currentSecondarySection, currentLevel: document.getElementById('currentLevel').textContent });

      let nextKey;
      let nextLevelText = currentLevel;
      if (key === 'Primary_Review_Section') {
        nextKey = 'Secondary_Review_Section';
        currentPrimarySection = d.key;
        nextLevelText = 'all > ' + d.key;
      } else if (key === 'Secondary_Review_Section') {
        nextKey = 'Tertiary_Review_Section';
        currentSecondarySection = d.key;
        nextLevelText = currentLevel + ' > ' + d.key;
      } else {
        // If there's no next key, do nothing
        return;
      }
      /*
      // Update current level
      document.getElementById('currentLevel').textContent = `現在の階層: ${nextKey}`;
      */
      // Filter data for the same theme as the double-clicked element
      const subData = data.filter(item => item[key] === d.key);

      // Display subtheme data in the same format
      createGraphs(subData, $("#slider-range").slider("values", 0), $("#slider-range").slider("values", 1), nextKey, nextLevelText);;

      // Show back button
      document.getElementById('backButton').style.display = 'block';
    })

    .on('click', async (event, d) => {
      if (key === 'Tertiary_Review_Section') {
        // 指定した小区分のデータを取得
        const selectedSection = encodeURIComponent(d.key);
        const response = await fetch(`https://excellent-grin-407604.an.r.appspot.com/research/individual?tertiaryReviewSection=${selectedSection}`);
        if (response.ok) {
          const groupData = await response.json();
          console.log(groupData);
          await saveToIndexedDB(groupData);
          const url = `/sankey?section=${selectedSection}&startYear=${year_start}&endYear=${year_end}`;
          window.location.href = url;
          // ここで取得したgroupDataを使用して、次の処理を行う
          // 例: 新しいページにデータを表示する、など
        } else {
          console.error('Failed to fetch data for', selectedSection);
        }


        /*
        // 現在のページの状態をsessionStorageに保存
        const currentState = {
          section: selectedSection,
          currentKey: key,
          startYear: year_start,
          endYear: year_end,
          primarySection: currentPrimarySection,
          secondarySection: currentSecondarySection,
        };

        sessionStorage.setItem('mainPageState', JSON.stringify(currentState));
        console.log("IndexedDBに保存しました");

        /*

        sessionStorage.setItem('section', selectedSection);
        sessionStorage.setItem('startYear', year_start);
        sessionStorage.setItem('endYear', year_end);
        sessionStorage.setItem('primarySection', currentPrimarySection);
        sessionStorage.setItem('secondarySection', currentSecondarySection);
        console.log("sessionStorageに保存しました");
        console.log(sessionStorage.getItem('selectedGroupData'));
        */



      }
    });
  ;

  // 各バブルに対応するテキストの追加
  svg.selectAll(".circleText")
    .data(nestedData.sort((a, b) => d3.descending(a.value.fund, b.value.fund)))
    .enter()
    .append("text")
    .attr("class", "circleText")
    .attr("x", (d) => paperScale(d.value.papers))
    .attr("y", (d) => scoreScale(d.value.score) + fundScale(d.value.fund))
    .attr("dy", "1em") // テキストの垂直位置を調整
    .attr("text-anchor", "middle") // テキストを中央揃え
    .style("font-size", "10px") // フォントサイズを指定
    .text((d) => {
      // バブルの半径に基づいてテキストの表示を制御
      if (fundScale(d.value.fund) > 40) { // 20は表示のしきい値
        return `${d.key}: ${parseFloat((d.value.fund / 10 ** 8).toFixed(0)).toLocaleString()}億円`;
      }
      return ""; // 小さなバブルには何も表示しない
    });

  if (if_redraw_word_cloud) {
    // 以降はワードクラウドの作成用
    // createGraphs関数内の最初の部分（既存のコード）は省略
    // 既存のワードクラウドを削除
    d3.select("#word-cloud").selectAll("*").remove();
    // 各研究課題のキーワードを集める
    let keywords = [];
    filteredData.forEach(d => {
      if (d['1st_Keyword']) keywords.push(d['1st_Keyword']);
      if (d['2nd_Keyword']) keywords.push(d['2nd_Keyword']);
      if (d['3rd_Keyword']) keywords.push(d['3rd_Keyword']);
    });

    // 単語の出現回数をカウントする
    let wordCounts = {};
    keywords.forEach(word => {
      if (wordCounts[word]) {
        wordCounts[word]++;
      } else {
        wordCounts[word] = 1;
      }
    });

    // 5回以上現れる単語のみを含む新しいリストを作成
    let minCount = 500 * (year_end - year_start + 1) / (2023 - 2003 + 1);
    if (currentKey === 'Secondary_Review_Section') {
      minCount = 50 * (year_end - year_start + 1) / (2023 - 2003 + 1);
    }
    else if (currentKey === 'Tertiary_Review_Section') {
      minCount = 10 * (year_end - year_start + 1) / (2023 - 2003 + 1);
    }
    let filteredWords = [];
    for (let word in wordCounts) {
      if (wordCounts[word] >= minCount) {
        filteredWords.push(word);
        console.log(word, wordCounts[word]);
      }
    }

    // 単語の出現回数に基づいてフォントサイズのスケールを設定
    let fontSize = d3.scaleSqrt()
      .domain([d3.min(Object.values(wordCounts)), d3.max(Object.values(wordCounts))])
      .range([3, 20]);

    let layout = d3.layout.cloud()
      .size([500, 500]) // Word Cloudのサイズを設定
      .words(filteredWords.map(word => ({
        text: word,
        size: fontSize(wordCounts[word]) // 単語の出現回数に基づくフォントサイズ
      })))
      .padding(5)
      .rotate(() => (~~(Math.random() * 6) - 3) * 30)
      .font("Impact")
      .fontSize(d => d.size)
      .on("end", draw);

    layout.start();

    // Word Cloudを描画する関数
    function draw(words) {
      let wordCloudSvg = d3.select("#word-cloud").append("svg")
        .attr("width", layout.size()[0])
        .attr("height", layout.size()[1])
        .append("g")
        .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")");

      wordCloudSvg.selectAll("text")
        .data(words)
        .enter().append("text")
        .style("font-size", d => d.size + "px")
        .style("font-family", "Impact")
        .attr("text-anchor", "middle")
        .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
        .text(d => d.text);
    }
  }
};

async function loadFromIndexedDB() {
  const db = await openIndexedDB();
  const transaction = db.transaction(["groupData"], "readonly");
  const store = transaction.objectStore("groupData");

  return new Promise((resolve, reject) => {
    const request = store.get("selectedGroupData");

    request.onsuccess = (event) => {
      if (event.target.result) {
        resolve(event.target.result.data);
      } else {
        resolve(null);
      }
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function loadFromIndexedDB_original_data() {
  const db = await openIndexedDB();
  const transaction = db.transaction(["originalData"], "readonly");
  const store = transaction.objectStore("originalData");

  return new Promise((resolve, reject) => {
    const request = store.get("originalData");

    request.onsuccess = (event) => {
      if (event.target.result) {
        resolve(event.target.result.data);
      } else {
        resolve(null);
      }
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
* main 関数
* 読み込み時一度だけ実行される
*/

let mean = 1;
let variance = 1;

const main = async () => {
  // ページ番号とページサイズを指定
  const page = 1;
  const pageSize = 50;

  // 以下データ取得の関数
  const fetchTotalSectionsCount = async () => {
    const apiUrl = 'https://excellent-grin-407604.an.r.appspot.com/research/sections-count';
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      return data.count;
    } catch (error) {
      console.error('Error fetching sections count:', error);
    }
  };

  const fetchResearchDataForPage = async (page, pageSize) => {
    const apiUrl = `https://excellent-grin-407604.an.r.appspot.com/research/all?page=${page}&pageSize=${pageSize}`;
    try {
      const response = await fetch(apiUrl);
      return await response.json();
    } catch (error) {
      console.error('Error fetching data for page:', error);
    }
  };

  const fetchAllResearchData = async (pageSize) => {
    const totalSectionsCount = await fetchTotalSectionsCount();
    const totalPages = Math.ceil(totalSectionsCount / pageSize);
    const promises = [];

    for (let page = 1; page <= totalPages; page++) {
      promises.push(fetchResearchDataForPage(page, pageSize));
    }

    const pagesData = await Promise.all(promises);
    return pagesData.flat(); // 全てのデータを結合
  };


  // データを取得
  const allData = await fetchAllResearchData(50);
  console.log('All fetched data:', allData);




  // データ取得終了



  const researchCategories = ['baseS', 'baseA', 'baseB', 'baseC', 'early_careers', 'Challenging_Research_Exploratory'];



  allDataCache = allData;

  let startYear = 2003;
  let endYear = 2023;

  // Sankey図から戻ってきたとき, primary/secondary categoryを復元する
  const state = sessionStorage.getItem('mainPageState');
  if (state) {
    const s = JSON.parse(state);
    // currentPrimarySection = sessionStorage.getItem('primarySection');
    // currentSecondarySection = sessionStorage.getItem('secondarySection');
    // sessionStorage.removeItem('primarySection');
    // sessionStorage.removeItem('secondarySection');
    section = s.section;
    currentPrimarySection = s.primarySection;
    currentSecondarySection = s.secondarySection;
    currentKey = s.currentKey;
    document.getElementById('currentLevel').textContent = s.currentLevel;

    startYear = s.startYear;
    endYear = s.endYear;

    previousData.push({ data: allData, key: 'Primary_Review_Section', primarySection: null, secondarySection: null, currentLevel: '' });

    const primaryFiltered = allData.filter(d => d['Primary_Review_Section'] === currentPrimarySection);
    const secondaryFiltered = primaryFiltered.filter(d => d['Secondary_Review_Section'] === currentSecondarySection);
    previousData.push({ data: primaryFiltered, key: 'Secondary_Review_Section', primarySection: currentPrimarySection, secondarySection: null, currentLevel: '' });
    // previousData.push({ data: secondaryFiltered, key: currentKey, primarySection: currentPrimarySection, secondarySection: currentSecondarySection, currentLevel: '' })

    sessionStorage.removeItem('mainPageState');

  }


  const stat = calculateCitationStatistics(allData);
  mean = stat.mean;
  variance = stat.variance;

  let if_institution = false;


  $("#slider-range").slider("values", 0, startYear);
  $("#slider-range").slider("values", 1, endYear);


  // 初期の年の範囲でグラフを作成
  const currentData = filterDataByCurrentSection(allData, currentKey, currentPrimarySection, currentSecondarySection);
  createGraphs(currentData, startYear, endYear, currentKey, breadcrumb(if_institution));
  // createGraphs(data, startYear, endYear,
  // viewTertiary ? 'Secondary_Review_Section'  :  'Primary_Review_Section',
  // 'all');
  // createGraphs(data, $("#slider-range").slider("values", 0), $("#slider-range").slider("values", 1), 'Primary_Review_Section', 'all');

  // スライダーの値が変わったときにグラフを更新
  $("#slider-range").on("slidechange", function () {
    startYear = $("#slider-range").slider("values", 0);
    endYear = $("#slider-range").slider("values", 1);

    if_redraw_word_cloud = true;
    const currentData = filterDataByCurrentSection(allData, currentKey, currentPrimarySection, currentSecondarySection);
    if (if_institution) {
      createGraphs(currentData, startYear, endYear, 'Institution');
    } else {
      createGraphs(currentData, startYear, endYear, currentKey)
    }
  });

  // Add click event listener to "select_institution" button
  document.getElementById('select_institution').addEventListener('click', () => {
    if_institution = true;
    if_redraw_word_cloud = false;

    document.getElementById('institution-selection').style.display = 'block';

    // 現在の階層に応じたデータをフィルタリング
    const currentData = filterDataByCurrentSection(allData, currentKey, currentPrimarySection, currentSecondarySection);

    // 現在のデータを記憶する
    previousData.push({ data: currentData, key: currentKey, currentLevel: document.getElementById('currentLevel').textContent });

    // 研究機関別のデータでグラフを再描画
    const filteredData = filterDataByInstitution(allData, currentKey);

    createGraphs(filteredData, startYear, endYear, 'Institution');
    // 現在の階層を更新
    document.getElementById('currentLevel').textContent = breadcrumb(true);

    // 他のボタンを非表示にし、「研究分野別に戻る」ボタンを表示
    document.getElementById('select_institution').style.display = 'none';
    document.getElementById('select_field').style.display = 'none';
    document.getElementById('return_to_field').style.display = 'block';
    document.getElementById('backButton').style.display = 'none';
  });

  // ランキングを表示する機関を指定するマークダウンの選択変更時のイベントリスナー
  document.getElementById('budget-range').addEventListener('change', function () {
    const selectedRange = this.value;
    const currentData = filterDataByCurrentSection(allData, currentKey, currentPrimarySection, currentSecondarySection);
    const nestedData = createNestedData(currentData, $("#slider-range").slider("values", 0), $("#slider-range").slider("values", 1), 'Institution');
    const filteredData = filterRankingDataByBudgetRange(nestedData, selectedRange);
    // フィルタリングされたデータでランキングを再生成
    displayRankings(filteredData);
  });

  // Add click event listener to "select_field" button
  document.getElementById('select_field').addEventListener('click', () => {
    if_institution = false;
    if_redraw_word_cloud = true;
    currentPrimarySection = null;
    currentSecondarySection = null;
    createGraphs(allData, $("#slider-range").slider("values", 0), $("#slider-range").slider("values", 1), 'Primary_Review_Section');
  });

  // "return_to_field"ボタンのイベントリスナー
  document.getElementById('return_to_field').addEventListener('click', () => {
    if_institution = false;
    // 以前のデータに戻る
    if (previousData.length > 0) {
      const lastData = previousData.pop();
      createGraphs(lastData.data, $("#slider-range").slider("values", 0), $("#slider-range").slider("values", 1), lastData.key, lastData.currentLevel);
      document.getElementById('currentLevel').textContent = lastData.currentLevel;
    }


    // 元のボタンを表示し、「研究分野別に戻る」ボタンを非表示
    document.getElementById('select_institution').style.display = 'block';
    document.getElementById('select_field').style.display = 'block';
    document.getElementById('backButton').style.display = 'block';
    document.getElementById('institution-selection').style.display = 'none';
    document.getElementById('return_to_field').style.display = 'none';

    // institution-selectionのマークダウンの値をデフォルト値に戻す
    document.getElementById('budget-range').value = "all";
  });



};



main();
