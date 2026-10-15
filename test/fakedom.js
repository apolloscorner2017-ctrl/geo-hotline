// Minimal fake DOM: just enough for hotline.js. Text nodes are {text}; elements track children + attrs.
// innerHTML is a trap: assigning to it throws, so any use in the code under test fails a test.
function textNode(t) { return { nodeType: 3, text: String(t) }; }
function element(tag, attrs) {
  const n = {
    nodeType: 1, tag, attrs: Object.assign({}, attrs), childNodes: [],
    get firstChild() { return this.childNodes[0] || null; },
    set innerHTML(v) { throw new Error("innerHTML is forbidden"); },
    appendChild(c) { this.childNodes.push(c); return c; },
    removeChild(c) { this.childNodes.splice(this.childNodes.indexOf(c), 1); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    get textContent() { return this.childNodes.map((c) => (c.nodeType === 3 ? c.text : c.textContent)).join(""); },
  };
  return n;
}
function makeDoc(nodes) {
  return {
    createElement: (t) => element(t),
    createTextNode: textNode,
    querySelectorAll: (sel) => (sel === "[data-hotline]" ? nodes : []),
  };
}
function find(node, tag, out = []) {
  node.childNodes.forEach((c) => { if (c.nodeType === 1) { if (c.tag === tag) out.push(c); find(c, tag, out); } });
  return out;
}
module.exports = { element, textNode, makeDoc, find };
