// Test file for Phase 0 verification
// This should be allowed in NONE phase

function add(a, b) {
  // Modified during RED phase - this should be BLOCKED
  return a + b;
}

module.exports = { add };
