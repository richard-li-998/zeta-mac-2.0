// Global variables
let gameActive = false;
let timer = 120;
let score = 0;
let currentAnswer = 0;
let currentOperation = "";
let timerInterval;
let projectedInterval;
let decimalMode = false;
let initialTimer = 120;
let fractionMode = false;
let currentFractionAnswer = null;

// Default denominators for fractions
const DEFAULT_DENOMINATORS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 25, 50, 100,
];

// Function to get current denominators from user input
function getCurrentDenominators() {
  const input = document.getElementById("custom-denominators").value.trim();
  
  if (!input) {
    return DEFAULT_DENOMINATORS;
  }
  
  // Parse the input string
  const denominators = input
    .split(',')
    .map(str => parseInt(str.trim()))
    .filter(num => !isNaN(num) && num > 0) // Only keep positive integers
    .sort((a, b) => a - b); // Sort numerically
  
  // Remove duplicates
  const uniqueDenominators = [...new Set(denominators)];
  
  // If no valid denominators found, return defaults
  if (uniqueDenominators.length === 0) {
    console.warn("No valid denominators found, using defaults");
    return DEFAULT_DENOMINATORS;
  }
  
  return uniqueDenominators;
}

// ===== UTILITY FUNCTIONS =====

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a, b) {
  return (a * b) / gcd(a, b);
}

function reduceFraction(num, den) {
  const divisor = gcd(Math.abs(num), Math.abs(den));
  return { num: num / divisor, den: den / divisor };
}

function formatFraction(num, den) {
  if (den === 1) return num.toString();

  const whole = Math.floor(Math.abs(num) / den);
  const remainder = Math.abs(num) % den;
  const sign = num < 0 ? "-" : "";

  if (whole === 0) {
    return `<span class="fraction"><span class="numerator">${sign}${remainder}</span><span class="denominator">${den}</span></span>`;
  } else if (remainder === 0) {
    return `${sign}${whole}`;
  } else {
    return `<span class="mixed-number">${sign}${whole}<span class="fraction"><span class="numerator">${remainder}</span><span class="denominator">${den}</span></span></span>`;
  }
}

function parseFractionInput(input) {
  input = input.trim();

  // Check if it's a decimal
  const decimalMatch = input.match(/^-?\d*\.?\d+$/);
  if (decimalMatch) {
    return parseFloat(input);
  }

  // Check for mixed number format like "2 3/4" or "2_3/4"
  const mixedMatch = input.match(/^(-?\d+)[\s_]+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    const sign = whole < 0 ? -1 : 1;
    return (Math.abs(whole) + num / den) * sign;
  }

  // Check for fraction format like "3/4" or "-3/4"
  const fractionMatch = input.match(/^(-?\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1]);
    const den = parseInt(fractionMatch[2]);
    return num / den;
  }

  // Check for whole number
  const wholeMatch = input.match(/^-?\d+$/);
  if (wholeMatch) {
    return parseInt(input);
  }

  return NaN;
}

function decimalToFraction(decimal) {
  const tolerance = 0.0001;
  const allowedDenominators = getCurrentDenominators();

  for (let den of allowedDenominators) {
    let num = Math.round(decimal * den);
    if (Math.abs(decimal - num / den) < tolerance) {
      return reduceFraction(num, den);
    }
  }

  // Fallback
  const sign = decimal < 0 ? -1 : 1;
  decimal = Math.abs(decimal);
  const whole = Math.floor(decimal);
  const fractional = decimal - whole;

  if (fractional < tolerance) {
    return { num: sign * whole, den: 1 };
  }

  let bestNum = 1,
    bestDen = 1,
    bestError = 1;

  for (let den of allowedDenominators) {
    let num = Math.round(fractional * den);
    let error = Math.abs(fractional - num / den);
    if (error < bestError) {
      bestError = error;
      bestNum = num;
      bestDen = den;
    }
  }

  const totalNum = sign * (whole * bestDen + bestNum);
  return reduceFraction(totalNum, bestDen);
}

function generateFractionFromDenominator(denominator, wholeNumberRange = null) {
  let wholeNumber = 0;
  
  if (wholeNumberRange) {
    const { min, max } = wholeNumberRange;
    if (max > 0) {
      wholeNumber = generateNumber(min, max, 0);
    }
  }
  
  // Generate a proper fraction (numerator < denominator) to avoid whole numbers
  const numerator = Math.floor(Math.random() * (denominator - 1)) + 1;
  
  // Convert to improper fraction if we have a whole number part
  const finalNumerator = wholeNumber * denominator + numerator;
  
  return { num: finalNumerator, den: denominator };
}

function generateNumber(min, max, decimalPlaces = 0) {
  if (decimalPlaces === 0) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  } else {
    const factor = Math.pow(10, decimalPlaces);
    const minScaled = min * factor;
    const maxScaled = max * factor;
    return (
      (Math.floor(Math.random() * (maxScaled - minScaled + 1)) +
        minScaled) /
      factor
    );
  }
}

// ===== PROBLEM GENERATION =====

function generateProblem() {
  const enabledOps = [];

  if (document.getElementById("addition").checked)
    enabledOps.push("addition");
  if (document.getElementById("subtraction").checked)
    enabledOps.push("subtraction");
  if (document.getElementById("multiplication").checked)
    enabledOps.push("multiplication");
  if (document.getElementById("division").checked)
    enabledOps.push("division");
  if (document.getElementById("fraction-conversion").checked) {
    if (document.getElementById("decimal-to-fraction").checked)
      enabledOps.push("decimal-to-fraction");
    if (document.getElementById("fraction-to-decimal").checked)
      enabledOps.push("fraction-to-decimal");
  }
  if (document.getElementById("fraction-arithmetic").checked) {
    if (document.getElementById("fraction-addition").checked)
      enabledOps.push("fraction-addition");
    if (document.getElementById("fraction-subtraction").checked)
      enabledOps.push("fraction-subtraction");
  }

  if (enabledOps.length === 0) {
    alert("Please select at least one operation");
    return;
  }

  // Check if we have valid denominators for fraction operations
  const hasFractionOps = enabledOps.some(op => op.includes("fraction"));
  if (hasFractionOps) {
    const denominators = getCurrentDenominators();
    if (denominators.length === 0) {
      alert("Please enter valid denominators for fraction operations (positive integers separated by commas)");
      return;
    }
  }

  const operation =
    enabledOps[Math.floor(Math.random() * enabledOps.length)];
  currentOperation = operation;
  fractionMode = operation.includes("fraction");
  currentFractionAnswer = null;

  let problemText = "";

  if (operation === "decimal-to-fraction") {
    const allowedDenominators = getCurrentDenominators();
    const denominator =
      allowedDenominators[
        Math.floor(Math.random() * allowedDenominators.length)
      ];
    
    // Get whole number range settings
    const wholeMin = parseInt(document.getElementById("fraction-whole-min").value) || 0;
    const wholeMax = parseInt(document.getElementById("fraction-whole-max").value) || 0;
    
    const fraction = generateFractionFromDenominator(denominator, { min: wholeMin, max: wholeMax });
    const decimal = fraction.num / fraction.den;

    problemText = `Convert ${decimal} to a fraction = `;
    currentFractionAnswer = reduceFraction(fraction.num, fraction.den);
    currentAnswer = null;
  } else if (operation === "fraction-to-decimal") {
    const allowedDenominators = getCurrentDenominators();
    const denominator =
      allowedDenominators[
        Math.floor(Math.random() * allowedDenominators.length)
      ];
    
    // Get whole number range settings
    const wholeMin = parseInt(document.getElementById("fraction-whole-min").value) || 0;
    const wholeMax = parseInt(document.getElementById("fraction-whole-max").value) || 0;
    
    const fraction = generateFractionFromDenominator(denominator, { min: wholeMin, max: wholeMax });
    const reduced = reduceFraction(fraction.num, fraction.den);

    problemText = `Convert ${formatFraction(
      reduced.num,
      reduced.den
    )} to a decimal = `;
    currentAnswer = reduced.num / reduced.den;
    currentFractionAnswer = null;
  } else if (operation === "fraction-addition") {
    const allowedDenominators = getCurrentDenominators();
    const den1 =
      allowedDenominators[
        Math.floor(Math.random() * allowedDenominators.length)
      ];
    const den2 =
      allowedDenominators[
        Math.floor(Math.random() * allowedDenominators.length)
      ];
    
    // Get whole number range settings
    const wholeMin = parseInt(document.getElementById("fraction-whole-min").value) || 0;
    const wholeMax = parseInt(document.getElementById("fraction-whole-max").value) || 0;
    
    const frac1 = generateFractionFromDenominator(den1, { min: wholeMin, max: wholeMax });
    const frac2 = generateFractionFromDenominator(den2, { min: wholeMin, max: wholeMax });

    const reduced1 = reduceFraction(frac1.num, frac1.den);
    const reduced2 = reduceFraction(frac2.num, frac2.den);

    const commonDen = lcm(reduced1.den, reduced2.den);
    const newNum1 = reduced1.num * (commonDen / reduced1.den);
    const newNum2 = reduced2.num * (commonDen / reduced2.den);
    const resultNum = newNum1 + newNum2;

    problemText = `${formatFraction(
      reduced1.num,
      reduced1.den
    )} + ${formatFraction(reduced2.num, reduced2.den)} = `;
    currentFractionAnswer = reduceFraction(resultNum, commonDen);
    currentAnswer = currentFractionAnswer.num / currentFractionAnswer.den;
  } else if (operation === "fraction-subtraction") {
    const allowedDenominators = getCurrentDenominators();
    const den1 =
      allowedDenominators[
        Math.floor(Math.random() * allowedDenominators.length)
      ];
    const den2 =
      allowedDenominators[
        Math.floor(Math.random() * allowedDenominators.length)
      ];
    
    // Get whole number range settings
    const wholeMin = parseInt(document.getElementById("fraction-whole-min").value) || 0;
    const wholeMax = parseInt(document.getElementById("fraction-whole-max").value) || 0;
    
    let frac1 = generateFractionFromDenominator(den1, { min: wholeMin, max: wholeMax });
    let frac2 = generateFractionFromDenominator(den2, { min: wholeMin, max: wholeMax });

    let reduced1 = reduceFraction(frac1.num, frac1.den);
    let reduced2 = reduceFraction(frac2.num, frac2.den);

    // Check if negative results are allowed
    const allowNegative = document.getElementById("allow-negative").checked;
    if (!allowNegative) {
      // Ensure first fraction is larger than second to avoid negative results
      const decimal1 = reduced1.num / reduced1.den;
      const decimal2 = reduced2.num / reduced2.den;
      
      if (decimal2 >= decimal1) {
        // Swap the fractions to ensure positive result
        [reduced1, reduced2] = [reduced2, reduced1];
      }
    }

    const commonDen = lcm(reduced1.den, reduced2.den);
    const newNum1 = reduced1.num * (commonDen / reduced1.den);
    const newNum2 = reduced2.num * (commonDen / reduced2.den);
    const resultNum = newNum1 - newNum2;

    problemText = `${formatFraction(
      reduced1.num,
      reduced1.den
    )} - ${formatFraction(reduced2.num, reduced2.den)} = `;
    currentFractionAnswer = reduceFraction(resultNum, commonDen);
    currentAnswer = currentFractionAnswer.num / currentFractionAnswer.den;
  } else if (operation === "addition") {
    const min1 = parseInt(document.getElementById("add-min1").value);
    const max1 = parseInt(document.getElementById("add-max1").value);
    const min2 = parseInt(document.getElementById("add-min2").value);
    const max2 = parseInt(document.getElementById("add-max2").value);

    const dec1 = decimalMode
      ? parseInt(document.getElementById("add-decimal1").value)
      : 0;
    const dec2 = decimalMode
      ? parseInt(document.getElementById("add-decimal2").value)
      : 0;

    const num1 = generateNumber(min1, max1, dec1);
    const num2 = generateNumber(min2, max2, dec2);
    let answer = num1 + num2;

    const formatNumber = (num, decimalPlaces) => {
      if (decimalMode && decimalPlaces > 0) {
        return num.toFixed(decimalPlaces);
      }
      return num.toString();
    };

    problemText = `${formatNumber(num1, dec1)} + ${formatNumber(num2, dec2)} = `;
    currentAnswer = answer;
  } else if (operation === "subtraction") {
    const min1 = parseInt(document.getElementById("sub-min1").value);
    const max1 = parseInt(document.getElementById("sub-max1").value);
    const min2 = parseInt(document.getElementById("sub-min2").value);
    const max2 = parseInt(document.getElementById("sub-max2").value);

    const dec1 = decimalMode
      ? parseInt(document.getElementById("sub-decimal1").value)
      : 0;
    const dec2 = decimalMode
      ? parseInt(document.getElementById("sub-decimal2").value)
      : 0;

    let num1 = generateNumber(min1, max1, dec1);
    let num2 = generateNumber(min2, max2, dec2);

    const allowNegative =
      document.getElementById("allow-negative").checked;
    if (!allowNegative && num2 >= num1) {
      [num1, num2] = [num2, num1];
    }

    let answer = num1 - num2;

    const formatNumber = (num, decimalPlaces) => {
      if (decimalMode && decimalPlaces > 0) {
        return num.toFixed(decimalPlaces);
      }
      return num.toString();
    };

    problemText = `${formatNumber(num1, dec1)} - ${formatNumber(num2, dec2)} = `;
    currentAnswer = answer;
  } else if (operation === "multiplication") {
    const min1 = parseInt(document.getElementById("mult-min1").value);
    const max1 = parseInt(document.getElementById("mult-max1").value);
    const min2 = parseInt(document.getElementById("mult-min2").value);
    const max2 = parseInt(document.getElementById("mult-max2").value);

    let num1, num2;
    let dec1 = 0, dec2 = 0;
    
    if (decimalMode) {
      const useDecimalForFirst = Math.random() < 0.5;
      dec1 = useDecimalForFirst
        ? parseInt(document.getElementById("mult-decimal1").value)
        : 0;
      dec2 = useDecimalForFirst
        ? 0
        : parseInt(document.getElementById("mult-decimal2").value);

      num1 = generateNumber(min1, max1, dec1);
      num2 = generateNumber(min2, max2, dec2);
    } else {
      num1 = generateNumber(min1, max1, 0);
      num2 = generateNumber(min2, max2, 0);
    }

    let answer = num1 * num2;

    const formatNumber = (num, decimalPlaces) => {
      if (decimalMode && decimalPlaces > 0) {
        return num.toFixed(decimalPlaces);
      }
      return num.toString();
    };

    problemText = `${formatNumber(num1, dec1)} × ${formatNumber(num2, dec2)} = `;
    currentAnswer = answer;
  } else if (operation === "division") {
    const min1 = parseInt(document.getElementById("div-min1").value);
    const max1 = parseInt(document.getElementById("div-max1").value);
    const min2 = parseInt(document.getElementById("div-min2").value);
    const max2 = parseInt(document.getElementById("div-max2").value);

    let num1, num2, answer;
    let dec1 = 0, dec2 = 0;
    
    if (decimalMode) {
      const useDecimalForFirst = Math.random() < 0.5;
      dec1 = useDecimalForFirst
        ? parseInt(document.getElementById("div-decimal1").value)
        : 0;
      dec2 = useDecimalForFirst
        ? 0
        : parseInt(document.getElementById("div-decimal2").value);

      num2 = generateNumber(min2, max2, dec2);
      while (num2 === 0) {
        num2 = generateNumber(min2, max2, dec2);
      }
      num1 = generateNumber(min1, max1, dec1);
      answer = num1 / num2;
    } else {
      answer = generateNumber(min1, max1);
      num2 = generateNumber(min2, max2);
      while (num2 === 0) {
        num2 = generateNumber(min2, max2);
      }
      num1 = answer * num2;
    }

    const formatNumber = (num, decimalPlaces) => {
      if (decimalMode && decimalPlaces > 0) {
        return num.toFixed(decimalPlaces);
      }
      return num.toString();
    };

    problemText = `${formatNumber(num1, dec1)} ÷ ${formatNumber(num2, dec2)} = `;
    currentAnswer = answer;
  }

  document.getElementById("problem").innerHTML = problemText;
}

// ===== GAME LOGIC =====

function startGame() {
  // Check if any operations are selected before starting
  const enabledOps = [];

  if (document.getElementById("addition").checked)
    enabledOps.push("addition");
  if (document.getElementById("subtraction").checked)
    enabledOps.push("subtraction");
  if (document.getElementById("multiplication").checked)
    enabledOps.push("multiplication");
  if (document.getElementById("division").checked)
    enabledOps.push("division");
  if (document.getElementById("fraction-conversion").checked) {
    if (document.getElementById("decimal-to-fraction").checked)
      enabledOps.push("decimal-to-fraction");
    if (document.getElementById("fraction-to-decimal").checked)
      enabledOps.push("fraction-to-decimal");
  }
  if (document.getElementById("fraction-arithmetic").checked) {
    if (document.getElementById("fraction-addition").checked)
      enabledOps.push("fraction-addition");
    if (document.getElementById("fraction-subtraction").checked)
      enabledOps.push("fraction-subtraction");
  }

  if (enabledOps.length === 0) {
    alert("Please select at least one operation");
    return; // Stop execution here - don't start the game
  }

  // Check if we have valid denominators for fraction operations
  const hasFractionOps = enabledOps.some(op => op.includes("fraction"));
  if (hasFractionOps) {
    const denominators = getCurrentDenominators();
    if (denominators.length === 0) {
      alert("Please enter valid denominators for fraction operations (positive integers separated by commas)");
      return; // Stop execution here - don't start the game
    }
  }

  // Only start the game if all validations pass
  gameActive = true;
  score = 0;
  timer = parseInt(document.getElementById("duration").value);
  initialTimer = timer;

  document.getElementById("settings-area").style.display = "none";
  document.getElementById("game-area").style.display = "block";
  document.getElementById("end-area").style.display = "none";

  // Clear and enable answer input
  document.getElementById("answer").value = "";
  document.getElementById("answer").disabled = false;
  document.getElementById("answer").style.display = "inline-block";

  updateDisplay();
  updateProjectedScore();
  generateProblem();

  document.getElementById("answer").focus();

  timerInterval = setInterval(() => {
    timer--;
    updateDisplay();
    if (timer <= 0) {
      endGame();
    }
  }, 1000);

  projectedInterval = setInterval(updateProjectedScore, 1000);
}

function updateDisplay() {
  document.getElementById("timer").textContent = timer;
  document.getElementById("score").textContent = score;
}

function updateProjectedScore() {
  const timeElapsed = initialTimer - timer;
  if (timeElapsed > 0 && score > 0) {
    const rate = score / timeElapsed;
    const projectedFinalScore = Math.round(rate * initialTimer);
    document.getElementById("projected-score").textContent =
      projectedFinalScore;
  } else {
    document.getElementById("projected-score").textContent = "0";
  }
}

function stopGame() {
  endGame();
}

function checkAnswer() {
  const userInput = document.getElementById("answer").value.trim();
  if (userInput === "") return;

  let isCorreect = false;

  if (fractionMode && currentFractionAnswer) {
    const userValue = parseFractionInput(userInput);
    if (!isNaN(userValue)) {
      const expectedDecimal =
        currentFractionAnswer.num / currentFractionAnswer.den;

      if (Math.abs(userValue - expectedDecimal) < 0.001) {
        isCorreect = true;
      } else {
        const userFraction = decimalToFraction(userValue);
        const reducedUser = reduceFraction(
          userFraction.num,
          userFraction.den
        );
        const reducedExpected = reduceFraction(
          currentFractionAnswer.num,
          currentFractionAnswer.den
        );

        if (
          reducedUser.num === reducedExpected.num &&
          reducedUser.den === reducedExpected.den
        ) {
          isCorreect = true;
        }
      }
    }
  } else if (currentOperation === "decimal-to-fraction") {
    const userValue = parseFractionInput(userInput);
    if (!isNaN(userValue)) {
      const userFraction = decimalToFraction(userValue);
      const reducedUser = reduceFraction(
        userFraction.num,
        userFraction.den
      );
      const reducedExpected = reduceFraction(
        currentFractionAnswer.num,
        currentFractionAnswer.den
      );

      if (
        reducedUser.num === reducedExpected.num &&
        reducedUser.den === reducedExpected.den
      ) {
        isCorreect = true;
      }
    }
  } else {
    const userAnswer = parseFloat(userInput);
    if (isNaN(userAnswer)) return;

    // Use appropriate tolerance based on decimal mode and precision setting
    let tolerance;
    if (decimalMode) {
      const precisionPlaces = parseInt(document.getElementById("answer-precision").value) || 2;
      tolerance = Math.pow(10, -precisionPlaces) / 2; // Half of the smallest unit for rounding
    } else {
      tolerance = 0.001;
    }

    if (Math.abs(userAnswer - currentAnswer) < tolerance) {
      isCorreect = true;
    }
  }

  if (isCorreect) {
    score++;
    generateProblem();
    document.getElementById("answer").value = "";
    updateDisplay();
  }
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);
  clearInterval(projectedInterval);

  document.getElementById("problem").textContent = `Score: ${score}`;
  document.getElementById("answer").style.display = "none";

  document.getElementById("end-area").style.display = "block";
  document.getElementById("answer").disabled = true;
}

function showSettings() {
  document.getElementById("settings-area").style.display = "block";
  document.getElementById("game-area").style.display = "none";
  document.getElementById("answer").disabled = false;
  document.getElementById("answer").style.display = "inline-block";
}

// ===== EVENT LISTENERS =====

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Input event listener for answer checking
  document.getElementById("answer").addEventListener("input", function (e) {
    if (gameActive) {
      checkAnswer();
    }
  });

  // Toggle decimal options visibility
  document
    .getElementById("decimal-mode")
    .addEventListener("change", function () {
      decimalMode = this.checked;
      const decimalOptions = document.querySelectorAll(".decimal-settings");
      decimalOptions.forEach((option) => {
        option.style.display = decimalMode ? "block" : "none";
      });
    });

  // Toggle fraction options visibility
  document
    .getElementById("fraction-conversion")
    .addEventListener("change", function () {
      const fractionOptions = document.getElementById(
        "fraction-conversion-settings"
      );
      fractionOptions.style.display = this.checked ? "block" : "none";
    });

  document
    .getElementById("fraction-arithmetic")
    .addEventListener("change", function () {
      const fractionOptions = document.getElementById(
        "fraction-arithmetic-settings"
      );
      fractionOptions.style.display = this.checked ? "block" : "none";
    });

  // Initialize toggles
  document
    .getElementById("decimal-mode")
    .dispatchEvent(new Event("change"));
  document
    .getElementById("fraction-conversion")
    .dispatchEvent(new Event("change"));
  document
    .getElementById("fraction-arithmetic")
    .dispatchEvent(new Event("change"));
});