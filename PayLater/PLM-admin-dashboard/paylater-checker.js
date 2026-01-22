/**
 * PayPal PayLater Message Availability Detection Module
 *
 * This module provides functionality to check PayPal PayLater message availability
 * across different countries. The function may produce console errors during
 * execution, which is normal. The final results will be returned upon completion.
 */

/**
 * Checks PayPal PayLater message availability across multiple countries
 * @param {string} clientId - PayPal Client ID
 * @param {Array<string>} countries - Array of country codes to test (default: common countries)
 * @returns {Promise<Array<Object>>} - Array of results for each country tested
 *
 * Note: During execution, you may see error messages in the browser console.
 * This is normal and expected. Please ignore these temporary error messages.
 * The function will return results when all checks are completed.
 */
async function checkPayLaterAvailability(
    clientId,
    countries = ["US", "GB", "DE", "FR", "IT", "ES", "AU", "CA"],
) {
    console.log(
        "%cStarting PayPal PayLater availability check...",
        "color: blue; font-weight: bold;",
    );
    console.log(
        "%cNote: Console errors during this process are normal. Please ignore temporary error messages.",
        "color: orange;",
    );

    // Dynamically load PayPal SDK if not already loaded
    if (!window.paypal) {
        console.log("Loading PayPal SDK...");
        await loadPayPalSDK(clientId);
    }

    // Wait for SDK to be ready
    console.log("Waiting for PayPal SDK to be ready...");
    await waitForPayPalSDK();

    if (!window.paypal || !window.paypal.Messages) {
        console.warn("PayPal SDK failed to load properly");
        resolve([]);
        return;
    }

    try {
        // Create a hidden container for test elements dynamically
        const container = document.createElement("div");
        container.id = "paylater-test-containers";
        container.style.cssText =
            "position: absolute; visibility: hidden; width: 1px; height: 1px; overflow: hidden;";
        document.body.appendChild(container);

        const results = await Promise.all(
            countries.map((item) => checkCountry(item)),
        );

        console.log("--------------------------------------------------");
        console.log("🏁 Final Report:");
        console.table(results);
        console.log("--------------------------------------------------");
    } catch (err) {
        console.error("Test suite error", err);
    } finally {
        // Clean up the test container
        const testContainer = document.getElementById(
            "paylater-test-containers",
        );
        if (testContainer) {
            testContainer.remove();
        }
    }

    console.log("%c=========================================", "color: green;");
    console.log(
        "%cPayPal PayLater availability check completed!",
        "color: green; font-weight: bold;",
    );
    console.log("%cAll tests finished. See results below.", "color: green;");
    console.log("%c=========================================", "color: green;");
    console.log("Final Results:", results);
}

function checkCountry(country) {
    return new Promise((resolve) => {
        // 1. 动态创建一个容器
        const containerId = `pp-msg-${country}`;
        const div = document.createElement("div");
        div.id = containerId;
        document.getElementById("test-containers").appendChild(div);

        let isResolved = false;

        // 2. 超时保护：如果 5秒内没有 onRender，认为失败（或不支持）
        const timer = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                resolve({
                    country,
                    success: false,
                    reason: "Timeout (Not Rendered)",
                });
                console.log(`⚠️ [${country}] Detection Timed out`);
            }
        }, 5000);

        // 3. 调用 SDK 渲染
        try {
            if (!window.paypal || !window.paypal.Messages) {
                throw new Error("SDK not ready");
            }

            paypal
                .Messages({
                    buyerCountry: country,
                    placement: "product",

                    // 成功回调
                    onRender: function () {
                        if (!isResolved) {
                            isResolved = true;
                            clearTimeout(timer);
                            resolve({
                                country,
                                success: true,
                                reason: "Rendered",
                            });
                            console.log(`✅ [${country}] Supported & Rendered`);
                        }
                    },
                })
                .render(`#${containerId}`)
                .catch((err) => {
                    // SDK 明确报错
                    if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timer);
                        resolve({
                            country,
                            success: false,
                            reason: err.message || "Render Error",
                        });
                        console.error(`❌ [${country}] Error:`, err);
                    }
                });
        } catch (e) {
            // 代码执行错误
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timer);
                resolve({
                    country,
                    success: false,
                    reason: e.message || "Script Error",
                });
            }
        }
    });
}

/**
 * Helper function to dynamically load PayPal SDK
 */
function loadPayPalSDK(clientId) {
    return new Promise((resolve, reject) => {
        // Check if script is already loaded
        if (document.querySelector(`script[src*="${clientId}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement("script");
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=messages`;

        script.onload = resolve;
        script.onerror = () => reject(new Error("Failed to load PayPal SDK"));

        document.head.appendChild(script);
    });
}

/**
 * Helper function to wait for PayPal SDK to be ready
 */
function waitForPayPalSDK() {
    return new Promise((resolve, reject) => {
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();

        const checkSdk = () => {
            if (window.paypal && window.paypal.Messages) {
                resolve();
            } else if (Date.now() - startTime > maxWaitTime) {
                reject(new Error("PayPal SDK took too long to load"));
            } else {
                setTimeout(checkSdk, 100);
            }
        };

        checkSdk();
    });
}

/**
 * Convenience function to display results in a formatted way
 */
function displayPayLaterResults(results) {
    console.log(
        "%c=== PayPal PayLater Availability Results ===",
        "color: blue; font-weight: bold;",
    );

    results.forEach((result) => {
        const statusSymbol = result.success ? "✅" : "❌";
        const statusColor = result.success ? "#2e7d32" : "#c62828";
        console.log(
            `%c${statusSymbol} ${result.country}: ${result.reason}`,
            `color: ${statusColor}`,
        );
    });

    const successfulCountries = results.filter((r) => r.success).length;
    console.log(
        `%cSummary: ${successfulCountries}/${results.length} countries support PayLater`,
        "color: #0277bd; font-weight: bold;",
    );
    console.log(
        "%c===========================================",
        "color: blue; font-weight: bold;",
    );
}

// Export for use in modules (if using module systems)
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        checkPayLaterAvailability,
        displayPayLaterResults,
    };
} else if (typeof window !== "undefined") {
    window.checkPayLaterAvailability = checkPayLaterAvailability;
    window.displayPayLaterResults = displayPayLaterResults;
}
