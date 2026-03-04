// String utility module for OOPS Phase 0 LLM learning tests

// Capitalizes the first letter of a string
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function reverse(str) {
  return str.split('').reverse().join('');
}

function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

function padStart(str, targetLength, padChar = ' ') {
  while (str.length < targetLength) {
    str = padChar + str;
  }
  return str;
}

module.exports = { capitalize, reverse, truncate, padStart };
