// 将二元组数组转换为字符串（方便 KMP 算法处理）
function arrayToString(arr) {
  return arr.join(",")
}

// 构建部分匹配表（PMT）
function buildPMT(pattern) {
  const pmt = new Array(pattern.length).fill(0);
  let len = 0; // 当前匹配的前缀长度
  for (let i = 1; i < pattern.length; i++) {
    while (len > 0 && pattern[i] !== pattern[len]) {
      len = pmt[len - 1]; // 回退到前一个匹配的位置
    }
    if (pattern[i] === pattern[len]) {
      len++;
    }
    pmt[i] = len;
  }
  return pmt;
}

// KMP 算法实现
function kmpSearch(text, pattern) {
  if (pattern.length === 0) return true; // 空模式串总是匹配
  const pmt = buildPMT(pattern);
  let j = 0; // 模式串的指针
  for (let i = 0; i < text.length; i++) {
    while (j > 0 && text[i] !== pattern[j]) {
      j = pmt[j - 1]; // 根据 PMT 表回退
    }
    if (text[i] === pattern[j]) {
      j++;
    }
    if (j === pattern.length) {
      return true; // 完全匹配
    }
  }
  return false; // 未找到匹配
}

// 判断 a 是否是 b 的子串
function isSubarrayKMP(a, b) {
  if (a.length === 0) return true; // 空数组是任何数组的子串
  if (b.length < a.length) return false; // 如果 b 比 a 短，a 不可能是 b 的子串

  // 将二元组数组转换为字符串
  const text = arrayToString(b);
  const pattern = arrayToString(a);

  // 使用 KMP 算法进行匹配
  return kmpSearch(text, pattern);
}

export default isSubarrayKMP