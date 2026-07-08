(function () {
  "use strict";

  const difficultyRates = {
    flat: { low: 5000, standard: 10000, high: 15000 },
    light: { low: 10000, standard: 20000, high: 30000 },
    elevation: { low: 20000, standard: 35000, high: 50000 },
    retainingLarge: { low: 40000, standard: 60000, high: 90000 },
    forestSlope: { low: 60000, standard: 90000, high: 130000 },
    unknown: { low: 20000, standard: 40000, high: 70000 }
  };

  const wallUnknownRiskRates = {
    low: 10000,
    standard: 20000,
    high: 40000
  };

  const defaultRiskChecks = {
    heightDifferenceRisk: "unknown",
    retainingWallRisk: "unknown",
    drainageRisk: "unknown",
    roadAccessRisk: "roadTypeUnknown",
    accessRouteRisk: "unknown",
    permitRisk: "developmentPermit",
    groundRisk: "unknown",
    neighborRisk: "unknown",
    removalRisk: "unknown"
  };

  const riskCheckDefinitions = [
    {
      key: "heightDifferenceRisk",
      label: "高低差リスク",
      confirm: "現地高低差、造成範囲、隣地とのレベル差",
      options: [
        { value: "none", label: "ほぼなし", score: 0 },
        { value: "under05", label: "0.5m未満", score: 1 },
        { value: "from05to1", label: "0.5m〜1.0m", score: 1 },
        { value: "from1to2", label: "1.0m〜2.0m", score: 2 },
        { value: "over2", label: "2.0m超", score: 3 },
        { value: "unknown", label: "不明", score: 2 }
      ]
    },
    {
      key: "retainingWallRisk",
      label: "擁壁リスク",
      confirm: "既存擁壁の種類、築年、ひび割れ、傾き、安全性",
      options: [
        { value: "none", label: "擁壁なし", score: 0 },
        { value: "newer", label: "新しそうな擁壁あり", score: 1 },
        { value: "old", label: "古い擁壁あり", score: 2 },
        { value: "stoneBlock", label: "大谷石・間知石・ブロック擁壁あり", score: 3 },
        { value: "crackTilt", label: "ひび割れ・傾きあり", score: 3 },
        { value: "unknown", label: "不明", score: 2 }
      ]
    },
    {
      key: "drainageRisk",
      label: "排水リスク",
      confirm: "雨水排水経路、放流先、側溝、越境排水の有無",
      options: [
        { value: "ok", label: "問題なさそう", score: 0 },
        { value: "routeCheck", label: "雨水排水経路要確認", score: 1 },
        { value: "ponding", label: "敷地内に水が溜まりやすそう", score: 2 },
        { value: "outletUnknown", label: "側溝・排水先が不明", score: 2 },
        { value: "neighborDrainage", label: "隣地排水・越境排水の可能性あり", score: 3 },
        { value: "unknown", label: "不明", score: 2 }
      ]
    },
    {
      key: "roadAccessRisk",
      label: "前面道路・接道リスク",
      confirm: "道路種別、幅員、建築基準法道路、私道負担、接道長さ",
      options: [
        { value: "publicWide", label: "公道・幅員十分", score: 0 },
        { value: "under4m", label: "幅員4m未満の可能性", score: 2 },
        { value: "privateRoad", label: "私道", score: 2 },
        { value: "designatedDevRoad", label: "位置指定道路・開発道路の確認要", score: 1 },
        { value: "roadTypeUnknown", label: "建築基準法道路か不明", score: 2 },
        { value: "concern", label: "接道に懸念あり", score: 3 }
      ]
    },
    {
      key: "accessRouteRisk",
      label: "搬入経路リスク",
      confirm: "工事車両の進入経路、道路幅、交通量、搬入制限",
      options: [
        { value: "ok", label: "問題なさそう", score: 0 },
        { value: "narrow", label: "道路が狭い", score: 1 },
        { value: "largeVehicleDifficult", label: "大型車進入が難しそう", score: 2 },
        { value: "stairsElevation", label: "階段・高低差で搬入困難", score: 3 },
        { value: "heavyTraffic", label: "周辺交通量が多い", score: 1 },
        { value: "unknown", label: "不明", score: 2 }
      ]
    },
    {
      key: "permitRisk",
      label: "開発・宅造・許認可リスク",
      confirm: "開発許可、宅造・盛土規制、がけ条例、土砂災害区域",
      options: [
        { value: "none", label: "特に懸念なし", score: 0 },
        { value: "lotSplit", label: "区画分割予定あり", score: 1 },
        { value: "developmentPermit", label: "開発許可の確認要", score: 2 },
        { value: "takuzoMudRegulation", label: "宅造区域・盛土規制区域の確認要", score: 2 },
        { value: "cliffDisaster", label: "がけ条例・急傾斜・土砂災害区域の確認要", score: 3 },
        { value: "high", label: "許認可リスク高い", score: 3 }
      ]
    },
    {
      key: "groundRisk",
      label: "地盤リスク",
      confirm: "造成履歴、地盤調査、浸水・液状化履歴、地盤改良要否",
      options: [
        { value: "low", label: "懸念少ない", score: 0 },
        { value: "fillPossible", label: "盛土・造成地の可能性", score: 1 },
        { value: "softPossible", label: "軟弱地盤の可能性", score: 2 },
        { value: "improvementPossible", label: "地盤改良の可能性あり", score: 2 },
        { value: "liquefactionFlood", label: "液状化・浸水履歴確認要", score: 2 },
        { value: "unknown", label: "不明", score: 2 }
      ]
    },
    {
      key: "neighborRisk",
      label: "隣地・越境リスク",
      confirm: "境界確定、越境物、隣地擁壁、隣地排水、近隣調整",
      options: [
        { value: "none", label: "特に懸念なし", score: 0 },
        { value: "boundaryUnfixed", label: "境界未確定", score: 2 },
        { value: "encroachment", label: "越境物の可能性あり", score: 2 },
        { value: "neighborWallDrainage", label: "隣地擁壁・隣地排水の影響あり", score: 2 },
        { value: "adjustmentNeeded", label: "高低差により隣地調整が必要そう", score: 3 },
        { value: "unknown", label: "不明", score: 2 }
      ]
    },
    {
      key: "removalRisk",
      label: "撤去物リスク",
      confirm: "古家、ブロック塀、庭石・樹木、地中埋設物の有無",
      options: [
        { value: "none", label: "特に懸念なし", score: 0 },
        { value: "oldHouse", label: "古家あり", score: 1 },
        { value: "blockWall", label: "ブロック塀あり", score: 1 },
        { value: "treesStones", label: "庭石・樹木多い", score: 2 },
        { value: "buriedObjects", label: "地中埋設物の可能性あり", score: 3 },
        { value: "unknown", label: "不明", score: 2 }
      ]
    }
  ];

  const defaultInput = {
    siteArea: "",
    effectiveSiteArea: "",
    lotCount: 1,
    currentStatus: "unknown",
    difficulty: "unknown",
    elevationGap: "unknown",
    slopeDegree: "unknown",
    roadLevelGap: "unknown",
    wallPresence: "none",
    wallLength: "",
    wallHeight: "",
    wallUnitPrice: 120000,
    oldHouse: "unknown",
    treesStones: "unknown",
    blockWall: "unknown",
    waterConnection: "unknown",
    sewerConnection: "unknown",
    gasConnection: "unknown",
    stormwater: "unknown",
    surveyNeed: "unknown",
    designNeed: "unknown",
    permitRisk: "unknown",
    fees: {
      buildingDemolition: 0,
      treesStonesRemoval: 0,
      blockWallRemoval: 0,
      waterConnection: 0,
      sewerConnection: 0,
      gasConnection: 0,
      stormwaterDrainage: 0,
      survey: 0,
      design: 0,
      permit: 0,
      geotechSurvey: 0,
      groundImprovement: 0
    },
    contingencyRate: 10,
    riskChecks: defaultRiskChecks,
    memo: ""
  };

  const defaultUnitPrices = {
    difficultyRates: difficultyRates,
    wallUnknownRiskRates: wallUnknownRiskRates
  };

  window.ZOUSEI_COST_DATA = {
    storageKey: "zouseiCostLocal.data.v1",
    defaultInput: defaultInput,
    defaultState: defaultInput,
    defaultUnitPrices: defaultUnitPrices,
    defaultDifficultyRates: difficultyRates,
    defaultWallUnknownRiskRates: wallUnknownRiskRates,
    defaultProjectName: "未名称案件",
    defaultPropertyType: "戸建用地",
    riskCheckDefinitions: riskCheckDefinitions,
    propertyTypes: [
      "戸建用地",
      "戸建分譲用地",
      "収益用地",
      "山林",
      "農地",
      "駐車場",
      "その他"
    ],
    labels: {
      difficulty: {
        flat: "ほぼ平坦",
        light: "やや造成あり",
        elevation: "高低差あり",
        retainingLarge: "擁壁・大規模造成あり",
        forestSlope: "山林・傾斜地",
        unknown: "不明"
      },
      currentStatus: {
        unknown: "不明",
        vacantLot: "更地",
        oldHouse: "古家あり",
        parking: "駐車場",
        farmland: "農地",
        forest: "山林",
        slope: "傾斜地",
        other: "その他"
      },
      wallPresence: {
        none: "なし",
        known: "あり・数量入力",
        unknownQuantity: "あり・数量不明",
        unknown: "不明"
      }
    }
  };
})();
