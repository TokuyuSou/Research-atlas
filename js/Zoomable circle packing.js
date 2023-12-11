/**
 * data を読み込む関数
 */
// const getData = async () => {
//     const data = await d3.json("./data/data.json");

//     // もし，読み込んだデータを加工したい場合は，ここで行う
//     return data;
// };

/**
 * グラフを描画する関数
 *
 */
// const createGraphs = (data) => {

//     // Specify the chart’s dimensions.
//     const width = 928;
//     const height = width;
  
//     // Create the color scale.
//     const color = d3.scaleLinear()
//         .domain([0, 5])
//         .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])
//         .interpolate(d3.interpolateHcl);
  
//     // Compute the layout.
//     const pack = data => d3.pack()
//         .size([width, height])
//         .padding(3)
//       (d3.hierarchy(data)
//         .sum(d => d.value)
//         .sort((a, b) => b.value - a.value));
//     const root = pack(data);
  
//     function zoomTo(v) {
//       const k = width / v[2];
  
//       view = v;
  
//       label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
//       node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
//       node.attr("r", d => d.r * k);
//     }
  
//     function zoom(event, d) {
//       const focus0 = focus;
  
//       focus = d;
  
//       const transition = svg.transition()
//           .duration(event.altKey ? 7500 : 750)
//           .tween("zoom", d => {
//             const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
//             return t => zoomTo(i(t));
//           });
  
//       label
//         .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })
//         .transition(transition)
//         .style("fill-opacity", d => d.parent === focus ? 1 : 0)
//         .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
//         .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });
//     }
    
//     // Create the SVG container.
//     const svg = d3.create("svg")
//         .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
//         .attr("width", width)
//         .attr("height", height);
  
//     // Append the nodes.
//     const node = svg.append("g")
//       .selectAll("circle")
//       .data(root.descendants().slice(1))
//       .join("circle")
//         .attr("fill", d => d.children ? color(d.depth) : "white")
//         .attr("pointer-events", "all")//.attr("pointer-events", d => !d.children ? "none" : null)
//         .on("mouseover", function() { d3.select(this).attr("stroke", "#000"); })
//         .on("mouseout", function() { d3.select(this).attr("stroke", null); })
//         .on("click", (event, d) => focus !== d && (zoom(event, d), event.stopPropagation()));
  
//     // Append the text labels.
//     const label = svg.append("g")
//         .style("font", "10px sans-serif")
//         .attr("pointer-events", "none")
//         .attr("text-anchor", "middle")
//         .selectAll("text")
//         .data(root.descendants())
//         .join("text")
//         .style("fill-opacity", d => d.parent === root ? 1 : 0)
//         .style("display", d => d.parent === root ? "inline" : "none")
//         .text(d => d.data.name);
  
//     // Create the zoom behavior and zoom immediately in to the initial focus node.
//     svg.on("click", (event) => zoom(event, root));
//     let focus = root;
//     let view;
//     zoomTo([focus.x, focus.y, focus.r * 2]);
  
//     return svg.node();
// }

/**
 * main 関数
 * 読み込み時一度だけ実行される
 */
// const main = async () => {
//     // data を読み込む
//     const data = await getData();
//     // data の中身を確認
//     console.log(data);
//     // グラフを描画する
//     const graph = createGraphs(data);
//     document.body.appendChild(graph);
// };

// main();
