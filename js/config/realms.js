const REALMS = [
  { id: "mortal", name: "凡体", required: 0, color: "#c4ced8" },
  { id: "qi", name: "炼气", required: 80, color: "#8bd6a7" },
  { id: "foundation", name: "筑基", required: 240, color: "#7ac5ef" },
  { id: "core", name: "金丹", required: 560, color: "#d9b55b" },
  { id: "soul", name: "元婴", required: 1180, color: "#c99bf1" },
  { id: "spirit", name: "化神", required: 2400, color: "#f08eb4" },
  { id: "void", name: "洞虚", required: 4800, color: "#78e1db" },
  { id: "immortal", name: "羽化", required: 9200, color: "#ffd27d" }
];

function getRealm(cultivation) {
  return [...REALMS].reverse().find((realm) => cultivation >= realm.required) || REALMS[0];
}

module.exports = { REALMS, getRealm };

