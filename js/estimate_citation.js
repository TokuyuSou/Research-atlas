function estimateCitations(papers) {
    // 事前分布のパラメータ（対数正規分布の平均と標準偏差）
    let priorMu = 1;
    let priorSigma = 1;

    // 観測データから被引用件数の平均を計算（対数スケールで）
    let observedCitations = papers
        .filter(paper => paper.citation_count != null)
        .map(paper => Math.log(paper.citation_count + 1));

    let observedMean = observedCitations.reduce((sum, val) => sum + val, 0) / observedCitations.length;
    let observedVariance = observedCitations.reduce((sum, val) => sum + (val - observedMean) ** 2, 0) / observedCitations.length;

    console.log("観測データの平均:", observedMean);

    console.log("観測データの分散:", observedVariance);

    // ベイズ更新を行い、新しい平均を計算
    
    let posteriorMu = (priorMu / priorSigma ** 2 + observedMean / observedVariance * observedCitations.length) / (1 / priorSigma ** 2 + observedCitations.length / observedVariance) ;

    // 推定された被引用件数（対数スケールから元のスケールに戻す）
    let estimatedCitations = Math.exp(posteriorMu);
    return estimatedCitations;
}

// 例: 論文データを配列として
let papers = [
    { citation_count: 0 },




    // 他の論文データ...
];

let estimatedCitations = estimateCitations(papers);

console.log("推定された被引用件数:", estimatedCitations);
