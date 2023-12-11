/**
 * data を読み込む関数
 */
/**
 * 指定された年度区間と小区分番号に基づいて、研究課題のデータを取得する関数
 * @param {string} researchSubject 研究種目
 * @param {number} startYear 開始年度
 * @param {number} endYear 終了年度
 * @param {number} tertiarySectionNumber 小区分番号
 * @returns 研究課題のデータの配列
 */
const getData = async (researchSubject, startYear, endYear, tertiarySectionName) => {
  let allData = [];

  for (let year = startYear; year <= endYear; year++) {
    const fileName = `output_${researchSubject}_${year}_with_citation.json`;
    const filePath = `/data/output_${researchSubject}_2003_2023/${fileName}`;

    try {
      const yearlyData = await d3.json(filePath);
      let titles = new Set(yearlyData.map(item => item.Title)); // その年のタイトルをセットに追加

      const filteredData = yearlyData.filter(item => {
        // 小区分番号に一致し、かつ重複していないアイテムをフィルタリング
        if (item.Tertiary_Review_Section === tertiarySectionName && titles.has(item.Title)) {
          titles.delete(item.Title); // フィルタリング後はタイトルをセットから削除
          return true;
        }
        return false;
      });

      allData = allData.concat(filteredData);
    } catch (error) {
      console.error(`Error loading data for year ${year}: ${error}`);
    }
  }

  return allData;
};



/*
出力： {
    nodes: [
        name: (研究課題),
        fixedValue: (研究費),
        category: (審査区分),
    ]
    links: [
        source: (研究課題名),
        target: (学会名 or 論文名),
        value: (論文の引用数 or 学会のconference_impact)
    ]
}
*/
// mode: "citation" | "conference". 被引用件数か学会別か 
// itemCount: 表示件数
// selectMode: 上位itemCount件のデータの選び方はawardAmount順かcitationCount順か
// showOthers: falseの場合、成果論文の上位10件のみを表示する。trueの場合、その他の論文も（まとめて）表示する
const setupSankeyData = (data, mode, itemCount, selectMode, showOthers) => {
  let leftElements = [];
  let links = [];

  let firstFoundJournalName = {}; // e.g. { "plos one": "PLoS ONE", ... }
  let rightElements = [];

  // データをソート
  if (selectMode === 'awardAmount') {
    data.sort((a, b) => b.Overall_Award_Amount_combined - a.Overall_Award_Amount_combined);
  } else if (selectMode === 'citation') {
    data.sort((a, b) => {
      const totalCitationsA = a.products.reduce((sum, p) => sum + (p.citation_count || 0), 0);
      const totalCitationsB = b.products.reduce((sum, p) => sum + (p.citation_count || 0), 0);
      return totalCitationsB - totalCitationsA;
    });
  }

  data = data.slice(0, itemCount); // 指定された件数だけデータを取得
  const conferenceMinHeight = 500;

  const totalBudget = data.reduce((acc, cur) => acc + cur["Overall_Award_Amount_combined"], 0)
  const totalCitation = data.reduce((acc, grant) => {
    return acc + grant.products.reduce((a, p) => a + (p["citation_count"] || 0), 0)
  }, 0);
  const totalImpact = data.reduce((acc, grant) => {
    return acc + grant.products.reduce((a, p) => a + (p.journal_impact || 0) + conferenceMinHeight, 0)
  }, 0);

  const valueFactor = (mode === "citation" ? totalCitation : totalImpact) / totalBudget;

  for (const grant of data) {
    leftElements.push({
      type: "grant",
      name: grant.Title,
      fixedValue: grant.Overall_Award_Amount_combined * valueFactor,
      category: grant.Category_Type,
      amount: grant.Overall_Award_Amount_combined,
    });

    const productsSorted = grant.products.sort((a, b) => b.citation_count - a.citation_count);
    let products = productsSorted.slice(0, 10);
    if (showOthers) {
      const othersProduct = {
        title: `その他${grant.products.length - 10}個の成果 : ${grant.Title}`,
        citation_count: productsSorted.slice(10, -1).reduce((acc, cur) => acc + (cur.citation_count || 0), 0)
      };
      if (othersProduct.citation_count > 0) products.push(othersProduct);
    }

    for (const paper of products) {
      if (paper.citation_count === undefined) continue;

      if (mode === "citation") {
        links.push({
          source: grant.Title,
          target: paper.title,
          value: (paper.citation_count || 0),
        });
        rightElements.push({
          type: "paper",
          name: paper.title,
          category: "paper",
          citation: paper.citation_count || 0,
          journal: paper.journal_title,
        });
      } else {
        const journalName = unifyJournalName(paper.journal_title);
        if (!firstFoundJournalName[journalName]) {
          firstFoundJournalName[journalName] = paper.journal_title;
          rightElements.push({
            type: "conference",
            // name: paper.journal_title,
            name: firstFoundJournalName[journalName],
            category: "international",
            // FIXME: * 5にするといい感じになる
            fixedValue: (paper.journal_impact || 0) + conferenceMinHeight * 5,
            impact: paper.journal_impact || 'unknown',
          });
        }

        links.push({
          source: grant.Title,
          // target: paper.journal_title,
          target: firstFoundJournalName[journalName],
          value: (paper.journal_impact || conferenceMinHeight),
        });
      }
    }
  }

  const nodes = [...leftElements, ...rightElements];
  console.log(nodes)
  return { nodes, links };
};

// create a horizontal link path used for sankey diagrams.
// the left-top anchor is located at (d.source.x1, d.source.y0)
// the right-top anchor is located at (d.target.x0, d.target.y0). These two anchors should be
// connected with a bezier curve (d3.curveBumpX).
// The bottom bezier curve should connect between (d.target.x0, d.target.y1) and (d.source.x1, d.target.y1).
// Those two bezier curves should be connected with a straight line.
const linkPath = (d, g) => {
  const path = (d) => {
    const topLeft = { x: d.source.x1, y: d.source.y0 };
    const topRight = { x: d.target.x0, y: d.target.y0 };
    const bottomLeft = { x: d.source.x1, y: d.source.y1 };
    const bottomRight = {
      x: d.target.x0,
      y: d.target.y1,
    };
    const topControl1 = { x: (topLeft.x + topRight.x) / 2.0, y: topLeft.y };
    const topControl2 = { x: (topLeft.x + topRight.x) / 2.0, y: topRight.y };
    const bottomControl1 = {
      x: (bottomLeft.x + bottomRight.x) / 2.0,
      y: bottomLeft.y,
    };
    const bottomControl2 = {
      x: (bottomLeft.x + bottomRight.x) / 2.0,
      y: bottomRight.y,
    };

    const c = (ob) => `${ob.x.toFixed(2)},${ob.y.toFixed(2)}`;
    return `M${c(topLeft)}C${c(topControl1)},${c(topControl2)},${c(
      topRight
    )}L${c(bottomRight)}C${c(bottomControl2)},${c(bottomControl1)},${c(
      bottomLeft
    )}Z`;
  };

  g.append("path").attr("d", path).attr("class", "linkpath");
};

const addNodeLegend = (svg, x, y, colorScale) => {
  // 凡例の位置を設定
  var legendSize = 20;
  var legendSpacing = 5;

  // 凡例を作成
  var legend = svg
    .selectAll(".legend")
    .data(colorScale.domain())
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", (_d, i) => {
      var height = legendSize + legendSpacing;
      var offset = (height * colorScale.domain().length) / 2;
      var vert = i * height - offset + y;
      return "translate(" + x + "," + vert + ")";
    });

  // 凡例の色を設定
  legend
    .append("rect")
    .attr("width", legendSize)
    .attr("height", legendSize)
    .style("fill", colorScale)
    .style("stroke", colorScale);

  // 凡例のテキストを設定
  legend
    .append("text")
    .attr("x", legendSize + legendSpacing)
    .attr("y", legendSize - legendSpacing)
    .text((d) => {
      if (d === "paper") return "論文";
      return d;
    });
};

/**
 * グラフを描画する関数
 */
// mode is either of "citation" or "conference"
const createGraphs = (data, mode, sortMode, itemCount, selectMode) => {
  // mode: 被引用件数かjournal_impactか
  // sortMode: 右辺のソートの有無、デフォルトか、被引用件数順
  // selectMode: 上位itemCount件のデータの選び方はawardAmount順かcitationCount順か
  // itemCount: 表示件数
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight * 2;

  window.addEventListener("resize", () => {
    createGraphs(data, mode, sortMode, itemCount, selectMode);
  })

  d3.selectAll("svg").remove();
  const svg = d3
    .select("#fig")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

  // Constructs and configures a Sankey generator.
  const sankey = d3
    .sankey()
    .nodeId((d) => d.name)
    .nodeAlign(d3.sankeyLeft)
    .nodeWidth(15)
    .nodePadding(10)
    .nodeSort((a, b) => {
      if (sortMode === "citation") {
        return b.value - a.value;
      }
      return undefined;
    })
    .extent([
      [310, 105],
      [width - 310, height - 5],
    ]);

  const sankeyData = setupSankeyData(data, mode, itemCount, selectMode, false);
  const { nodes, links } = sankey(sankeyData);

  const color = d3.scaleOrdinal().range(d3.schemeCategory10);

  let activeNode = null;

  const selectNode = (d) => {
    svg.selectAll("rect").join()
      .style("opacity", (other) => {
        if (d.name === other.name
          || d.sourceLinks.map(x => x.target.name).includes(other.name)
          || d.targetLinks.map(x => x.source.name).includes(other.name))
          return 1.0;
        else return 0.3;
      })

    svg.selectAll("g.link").join()
      .style("opacity", (other) => (d.name === other.source.name || d.name === other.target.name) ? 1.0 : 0.3)
  }

  const deselectNode = () => {
    svg.selectAll("rect").join()
      .style("opacity", 1.0)
    svg.selectAll("g.link").join()
      .style("opacity", 1.0)
  }

  svg.on("click", (event) => {
    activeNode = null;
    deselectNode();
  })

  // Creates the rects that represent the nodes.
  svg
    .append("g")
    .attr("stroke", "#000")
    .selectAll()
    .data(nodes)
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", (d) => color(d.category))
    .on("click", (event, d) => {
      activeNode = d;
      selectNode(d);
      console.log(d);
      event.stopPropagation();
    })
    .on("mouseover", (event, d) => {
      const x = event.pageX;
      const y = event.pageY;
      const tooltip = d3.select("#tooltip");
      tooltip
        .style("left", x + "px")
        .style("top", y + "px")
        .style("visibility", "visible")

      if (d.type === "grant") {
        tooltip.html(`${d.name}<br>${d.amount.toLocaleString()}円交付`);
      }
      if (d.type === "paper") {
        tooltip.html(`${d.name}<br>${d.journal}にて発表<br>${d.citation}回引用`);
      }
      if (d.type === "conference") {
        tooltip.html(`${d.name}<br>h5-index: ${d.impact}`);
      }

      if (!activeNode) selectNode(d);
    })
    .on("mousemove", (event) => {
      const x = event.pageX;
      const y = event.pageY;
      const tooltip = d3.select("#tooltip");
      tooltip
        .style("left", x + "px")
        .style("top", y + "px");
    })
    .on("mouseout", () => {
      const tooltip = d3.select("#tooltip");
      tooltip.style("visibility", "hidden");

      if (!activeNode) deselectNode();
    });

  d3.select("body")
    .append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("z-index", 10)
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "1px")
    .style("padding", "10px")
    .style("pointer-events", "none")
    .style("visibility", "hidden")
    .style("transform", "translate(0,-100%)");

  // Adds a title on the nodes.
  // if (mode === "citation") {
  //   rect.append("title").text((d) => `${d.name}\n${format(d.value)}件引用`);
  // } else {
  //   rect
  //     .append("title")
  //     .text((d) => `${d.name}\n投稿先の影響力：${format(d.value)}`);
  // }

  // Creates the paths that represent the links.
  const link = svg
    .selectAll("g.link")
    .data(links)
    .enter()
    .append("g")
    .attr("class", "link")
    .style("mix-blend-mode", "multiply");

  link.each((d, i, glist) => {
    let g = d3.select(glist[i]);
    linkPath(d, g);
  });

  // Creates a gradient, if necessary, for the source-target color option.
  const linkColor = "source";
  if (linkColor === "source-target") {
    const gradient = link
      .append("linearGradient")
      .attr("id", (d) => (d.uid = DOM.uid("link")).id)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", (d) => d.source.x1)
      .attr("x2", (d) => d.target.x0);
    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", (d) => color(d.source.category));
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", (d) => color(d.target.category));
  }

  link
    .append("path")
    .attr(
      "stroke",
      linkColor === "source-target"
        ? (d) => d.uid
        : linkColor === "source"
          ? (d) => color(d.source.category)
          : linkColor === "target"
            ? (d) => color(d.target.category)
            : linkColor
    )
    .attr("stroke-width", (d) => Math.max(1, d.width));

  // add legends below sankey diagram
  addNodeLegend(svg, 10, 50, color);

  // Adds labels on the nodes.
  d3.select("body")
    .append("div.node-labels")
    .selectAll()
    .data(nodes)
    .join("span");

  svg
    .append("g")
    .selectAll()
    .data(nodes)
    .join("foreignObject")
    .attr("class", "node-label")
    .attr("x", (d) => (d.x0 < width / 2 ? d.x0 - 306 : d.x1 + 6))
    .attr("y", (d) => d.y0 - (d.y1 - d.y0) / 2)
    .attr("width", 300)
    .attr("height", (d) => (d.y1 - d.y0) * 2)
    .append("xhtml:div")
    .style("font-size", "12px")
    .style("width", "100%")
    .style("height", "100%")
    .style("display", "flex")
    .style("word-wrap", "break-word")
    .style("text-align", (d) => (d.x0 < width / 2 ? "right" : "left"))
    .style("align-items", "center")
    .style("justify-content", (d) =>
      d.x0 < width / 2 ? "flex-end" : "flex-start"
    )
    .text((d) => {
      // あまりにnodeが小さくなる場合は論文名を表示しない
      if (mode === "citation" && d.y1 - d.y0 < 20) {
        return "";
      }
      return d.name;
    });
};

const getQueryParams = (params) => {
  console.log(window.location.search);
  const urlParams = new URLSearchParams(window.location.search);
  const queryParams = {};
  params.forEach(param => {
    if (urlParams.has(param)) {
      queryParams[param] = urlParams.get(param);
    }
  });
  console.log(queryParams);
  return queryParams;
};

const listGrants = (grants) => {
  console.log(grants)

  const header = `
    <tr><th>研究課題名</th><th>代表者</th><th>期間</th><th>総配分額</th><th>1年あたりの配分額</th></tr>
  `

  const tbody = grants.map((g) => {
    const yearlyBudget = Math.floor(g["Overall_Award_Amount_combined"] / (g["End_Year"] - g["Start_Year"] + 1));
    const searchLink = `<a href="https://kaken.nii.ac.jp/en/search/?kw=${encodeURIComponent(g["Title"])}">${g["Title"]}</a>`

    return `<tr><td>${searchLink}</td><td>${g["Principal_Investigator"]}（${g["Institution"]}）</td><td>${g["Start_Year"]}-${g["End_Year"]}</td>
      <td class="num">${g["Overall_Award_Amount_combined"].toLocaleString()}</td><td class="num">${yearlyBudget.toLocaleString()}</td></tr>`
  }).join("\n")

  document.getElementById("grants").innerHTML = `${header}${tbody}`;
}

async function getLatestVersion(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = (event) => {
      const db = event.target.result;
      const version = db.version;
      db.close();
      resolve(version);
    };
    request.onerror = (event) => {
      reject('Failed to open IndexedDB for version check.');
    };
  });
}

async function openIndexedDB() {
  const latestVersion = await getLatestVersion("MyDatabase");
  console.log(latestVersion);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MyDatabase", latestVersion);

    /*
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore("groupData", { keyPath: "id" });
      db.createObjectStore("originalData", { keyPath: "id" });
    };
    */

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}


async function loadFromIndexedDB() {
  const db = await openIndexedDB();
  const transaction = db.transaction(["groupData"], "readonly");
  const store = transaction.objectStore("groupData");

  return new Promise((resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = (event) => {
      if (event.target.result) {
        resolve(event.target.result);
        console.log("loaded from indexedDB");

      } else {
        resolve(null);
        console.log("no data in indexedDB");
      }
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 雑誌名の表記ゆれを（可能な限り）取り除いた形での雑誌名を返す。
// e.g. unifyJournalName("PLoS ONE") ==
// unifyJournalName("PLOS ONE") ==
// unifyJournalName("Plos One.") ==
// unifyJournalName("plos one") == "plos one"
const unifyJournalName = (name) => {
  return name.toLowerCase().replace(/\./g, '').trim();
}

/**
 * main 関数
 * 読み込み時一度だけ実行される
 */
const main = async () => {
  let GroupData;
  // URLからクエリパラメータを取得
  const queryParams = getQueryParams(['section', 'startYear', 'endYear']);
  const researchSubject = "early_careers"; // この値を動的に変更するか、固定値を使う
  /*
  const startYear = queryParams.startYear || 2015;
  const endYear = queryParams.endYear || 2023;
  const tertiarySectionName = queryParams.section || '地域研究関連';
  */
  // 新しいページで取得する際
  const tertiarySectionName = sessionStorage.getItem('section') || '地域研究関連';
  const startYear = sessionStorage.getItem('startYear');
  const endYear = sessionStorage.getItem('endYear');
  const storedData = await loadFromIndexedDB();
  //const storedData = sessionStorage.getItem('selectedGroupData');

  if (storedData) {
    // セッションストレージにデータがある場合は、そちらを優先して表示
    GroupData = storedData[0];
    console.log(storedData);
  } else {
    // セッションストレージにデータがない場合は、一からデータを読み込み
    GroupData = await getData(researchSubject, startYear, endYear, tertiarySectionName);
  }

  // グラフの表示件数、ソート順の初期値を設定
  let itemCount = 10; // 初期表示件数

  const typeEl = document.getElementById("type");
  const sortEl = document.getElementById("sort");
  const selectDataEl = document.getElementById("selectData");

  //createGraphs関数の引数：data, mode, sortMode, itemCount, selectMode
  // typeEl.value: mode
  // sortEl.value: sortMode
  // selectDataEl.value: selectDataEl

  document.getElementById("type").addEventListener("change", (e) => {
    createGraphs(GroupData, e.target.value, sortEl.value, itemCount, selectDataEl.value);
  });

  document.getElementById("sort").addEventListener("change", (e) => {
    createGraphs(GroupData, typeEl.value, e.target.value, itemCount, selectDataEl.value);
  });

  document.getElementById("selectData").addEventListener("change", (e) => {
    createGraphs(GroupData, typeEl.value, sortEl.value, itemCount, selectDataEl.value);
  });
  document.getElementById("itemCount").addEventListener("change", (e) => {
    createGraphs(GroupData, typeEl.value, sortEl.value, parseInt(e.target.value), selectDataEl.value);
  });

  document.getElementById('backButton').addEventListener('click', () => {
    history.go(-1);
  });

  document.getElementById("page_title").addEventListener("click", () => {
    history.go(-1);
  });



  // グラフを描画する
  createGraphs(GroupData, "citation", "default", itemCount, "awardAmount");

  listGrants(GroupData)
};

main();
