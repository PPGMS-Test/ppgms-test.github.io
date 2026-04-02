/*
 * Define the version of the Google Pay API referenced when creating your configuration
 * 指定Google Pay 版本, 是必须的
 */
const baseRequest = {
    apiVersion: 2,
    apiVersionMinor: 0,
};

let paymentsClient = null,
    allowedPaymentMethods = null,
    //merchantInfo需要包含merchantName和merchantID
    //不过这里不是很关键, 因为在使用PayPal OrderV2的时候传了merchant参数
    merchantInfo = null;

/* Configure your site's support for payment methods supported by the Google Pay */
// 参考Google Pay dev doc第6步
function getGoogleIsReadyToPayRequest(allowedPaymentMethods) {
    console.log(
        "[5](getGoogleIsReadyToPayRequest): wrap a request object for isReadyToPay. 对象合并以提供一个符合规范的对象"
    );
    return Object.assign({}, baseRequest, {
        allowedPaymentMethods: allowedPaymentMethods,
    });
}

/* Fetch Default Config from PayPal via PayPal SDK */
// 参考Google Pay dev doc第6步
async function getGooglePayConfig() {
    console.log(
        "[3](getGooglePayConfig): Get isReadyToPay Object!确定是否能使用GooglePay进行付款"
    );
    if (allowedPaymentMethods == null || merchantInfo == null) {
        const googlePayConfig = await paypal.Googlepay().config();
        allowedPaymentMethods = googlePayConfig.allowedPaymentMethods;
        merchantInfo = googlePayConfig.merchantInfo;
    }
    return {
        allowedPaymentMethods,
        merchantInfo,
    };
}

/* Configure support for the Google Pay API */
// 参考google pay dev第8步
async function getGooglePaymentDataRequest() {
    //构建一个JS对象来说明当前网站对Google Pay API的支持情况
    const paymentDataRequest = Object.assign({}, baseRequest);
    //添加当前应用的付款方式, 在这里就是PayPal
    const { allowedPaymentMethods, merchantInfo } = await getGooglePayConfig();

    //卡相关参数
    // https://developers.google.com/pay/api/web/reference/request-objects#CardParameters
    const billingAddressParameters =
        allowedPaymentMethods?.[0]?.parameters?.billingAddressParameters;
    billingAddressParameters.phoneNumberRequired = true;

    paymentDataRequest.allowedPaymentMethods = allowedPaymentMethods;

    // debugger;
    //添加测试的交易信息

    paymentDataRequest.transactionInfo = getGoogleTransactionInfo();
    paymentDataRequest.merchantInfo = merchantInfo;

    paymentDataRequest.merchantInfo.merchantName = "AAAABBB";
    // debugger;

    //使用回调 intent 加载付款数据
    paymentDataRequest.callbackIntents = ["PAYMENT_AUTHORIZATION"];

    // paymentDataRequest.shippingAddressRequired = true;
    // paymentDataRequest.emailRequired = true;

    return paymentDataRequest;
}

function onPaymentAuthorized(paymentData) {
    return new Promise(function (resolve, reject) {
        console.log("[9]The user authorized this transaction!");
        processPayment(paymentData)
            .then(function (data) {
                resolve({ transactionState: "SUCCESS" });
            })
            .catch(function (errDetails) {
                resolve({ transactionState: "ERROR" });
            });
    });
}

//初始化paymentClient  参照Google Pay Dev第五步
function getGooglePaymentsClient() {
    console.log(
        "[2](getGooglePaymentsClient): Google Pay Client is initialize!"
    );
    if (paymentsClient === null) {
        paymentsClient = new google.payments.api.PaymentsClient({
            environment: "TEST",
            // environment: "PRODUCTION",
            paymentDataCallbacks: {
                //注册: 在买家授权之后
                //参考Dev Doc第11步 设置授权付款
                onPaymentAuthorized: onPaymentAuthorized,

                //这里还可以添加onPaymentDataChanged的回调函数, 用于解决运费/促销的问题
                //参考Dev Doc第12步 设置授权付款
            },
        });
    }
    return paymentsClient;
}

// 主要方法, 当来自Google的脚本加载后做的事情
async function onGooglePayLoaded() {
    console.log("[1](onGooglePayLoaded): Google Pay Script is loaded!");
    const paymentsClient = getGooglePaymentsClient();
    const { allowedPaymentMethods } = await getGooglePayConfig();

    console.log("[4](onGooglePayLoaded): execute isReadyToPay() function");
    paymentsClient
        .isReadyToPay(getGoogleIsReadyToPayRequest(allowedPaymentMethods))
        .then(function (response) {
            if (response.result) {
                console.log(
                    "[6](onGooglePayLoaded.isReadyToPay): Congratulation! Google Pay is support!"
                );
                addGooglePayButton();
            }
        })
        .catch(function (err) {
            console.error(err);
        });
}

// Add button after everything goes well
function addGooglePayButton() {
    console.log("[7](addGooglePayButton): Add Google Pay Button.");
    const paymentsClient = getGooglePaymentsClient();
    const button = paymentsClient.createButton({
        onClick: onGooglePaymentButtonClicked,
    });
    document.getElementById("button-container").appendChild(button);
}

function getGoogleTransactionInfo() {
    return {
        countryCode: "US",
        currencyCode: "USD",
        totalPriceStatus: "FINAL",
        totalPrice: "33.98",
        totalPriceLabel: "Total",
    };
}

// click事件的handler
async function onGooglePaymentButtonClicked() {
    console.log(
        "[8](onGooglePaymentButtonClicked): Google Pay Button is Clicked!."
    );
    const paymentDataRequest = await getGooglePaymentDataRequest();
    paymentDataRequest.transactionInfo = getGoogleTransactionInfo();
    const paymentsClient = getGooglePaymentsClient();

    //参考Google Pay dev doc第10步
    console.log(JSON.stringify(paymentDataRequest, null, "  "));
    // debugger;
    paymentsClient.loadPaymentData(paymentDataRequest);
    //其他的支付网关比如使用银行卡之类的到这里可能就结束了, 从paymentsClient获取token并传给第三方支付机构
}

async function processPayment(paymentData) {
    try {
        // const { currencyCode, totalPrice } = getGoogleTransactionInfo();
        const order = {
            intent: "CAPTURE",
            purchase_units: [
                {
                    reference_id: "default",
                    description: "txgsyr order 24212065573227",
                    // "invoice_id": "24212065573227",
                    custom_id: "shoppaas_1722304979933",
                    items: [
                        {
                            name: "3D Surround Open OWS Bluetooth-Kopfhörer",
                            description: "",
                            sku: "Schwarz-orange",
                            quantity: 1,
                            unit_amount: {
                                currency_code: "USD",
                                value: "25.99",
                            },
                            category: "PHYSICAL_GOODS",
                        },
                    ],
                    amount: {
                        currency_code: "USD",
                        value: "33.98",
                        breakdown: {
                            item_total: {
                                currency_code: "USD",
                                value: "25.99",
                            },
                            tax_total: {
                                currency_code: "USD",
                                value: "0.00",
                            },
                            shipping: {
                                currency_code: "USD",
                                value: "7.99",
                            },
                            handling: {
                                currency_code: "USD",
                                value: 0,
                            },
                            insurance: {
                                currency_code: "USD",
                                value: 0,
                            },
                            discount: {
                                currency_code: "USD",
                                value: "0.00",
                            },
                        },
                    },
                },
            ],
            payment_source: {
                google_pay: {
                    experience_context: {
                        brand_name: "My Test",
                        
                        cancel_url: "https://ip111.cn/",
                        return_url: "https://ip111.cn/",
                        user_action: "PAY_NOW",
                        // shipping_preference: "SET_PROVIDED_ADDRESS" | 'GET_FROM_FILE| "SET_PROVIDED_ADDRESS"
                    },

                },
            },

        };
        const accessToken = await generateAccessToken();
        // console.log(accessToken)

        /* Create Order */
        console.log("[10]Order V2 -- Create Order is called!");
        const { id } = await fetch(
            "https://api.sandbox.paypal.com/v2/checkout/orders",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(order),
            }
        ).then((res) => res.json());

        console.log("paymentData:");
        console.log(JSON.stringify(paymentData, null, "  "));
        // debugger;
        console.log("PayPal order id:", id);

        // paymentData.paymentMethodData.info.billingAddress.email =
        //     paymentData.email;

        const googleConfirmRes = await paypal.Googlepay().confirmOrder({
            orderId: id,
            paymentMethodData: paymentData.paymentMethodData,
            // shippingAddress: paymentData.shippingAddress,
            email: paymentData.email,
        });

        console.log("googleConfirmRes:");
        console.log(JSON.stringify(googleConfirmRes, null, "  "));
        // debugger;
        const { status } = googleConfirmRes;

        console.log("Status: google pay confirm order:", status);

        //Get Order Detail
        const getOrderDetail = await fetch(
            `https://api.sandbox.paypal.com/v2/checkout/orders/${id}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        ).then((res) => res.json());

        console.log(JSON.stringify(getOrderDetail, null, "  "));
        debugger;

        // return;

        //TODO
        //这里是做Strong Customer Authentication (SCA)的验证, 但是我还没有试出来如何让状态变为PAYER_ACTION_REQUIRED
        if (status === "PAYER_ACTION_REQUIRED") {
            console.log(
                "==== Confirm Payment Completed Payer Action Required ====="
            );
            paypal
                .Googlepay()
                .intiatePayerAction({ orderId: id })
                .then(async () => {
                    console.log("===== Payer Action Completed =====");
                    /** GET Order */
                    const orderResponse = await fetch(`/orders/${id}`, {
                        method: "GET",
                    }).then((res) => res.json());
                    console.log("===== 3DS Contingency Result Fetched =====");
                    console.log(
                        orderResponse?.payment_source?.google_pay?.card
                            ?.authentication_result
                    );
                    /* CAPTURE THE ORDER*/
                    const captureResponse = await fetch(
                        `/orders/${id}/capture`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                            },
                        }
                    ).then((res) => res.json());
                    console.log(" ===== Order Capture Completed ===== ");
                });
        } else if (status === "APPROVED") {
            /* Capture the Order */
            console.log("[11]Order V2 -- Capture Order is called!");

            const captureResponse = await fetch(
                `https://api.sandbox.paypal.com/v2/checkout/orders/${id}/capture`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            ).then((res) => res.json());

            console.log("Success!");

            console.log("captureResponse:");
            console.log(JSON.stringify(captureResponse, null, "  "));

            return { transactionState: "SUCCESS" };
        } else {
            return { transactionState: "ERROR" };
        }
    } catch (err) {
        return {
            transactionState: "ERROR",
            error: {
                message: err.message,
            },
        };
    }
}

async function generateAccessToken() {
    const url = "https://api.sandbox.paypal.com/v1/oauth2/token";

    let accessToken = btoa(`${client_id}:${secret_key}`);

    let params = {
        grant_type: "client_credentials",
    };
    let formData = new URLSearchParams(params);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${accessToken}`,
        },
        body: formData,
    });
    const data = await response.json();
    // console.log(data)
    console.log(data.access_token);
    return data.access_token;
}