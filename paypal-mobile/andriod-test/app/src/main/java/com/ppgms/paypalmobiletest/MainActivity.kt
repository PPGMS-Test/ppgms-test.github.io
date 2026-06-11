package com.ppgms.paypalmobiletest

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.activity.ComponentActivity
import com.paypal.android.corepayments.CoreConfig
import com.paypal.android.corepayments.Environment
import com.paypal.android.paypalwebpayments.PayPalPresentAuthChallengeResult
import com.paypal.android.paypalwebpayments.PayPalWebCheckoutClient
import com.paypal.android.paypalwebpayments.PayPalWebCheckoutFinishStartResult
import com.paypal.android.paypalwebpayments.PayPalWebCheckoutFundingSource
import com.paypal.android.paypalwebpayments.PayPalWebCheckoutRequest

class MainActivity : ComponentActivity() {

    private lateinit var clientIdInput: EditText
    private lateinit var orderIdInput: EditText
    private lateinit var returnSchemeInput: EditText
    private lateinit var environmentSpinner: Spinner
    private lateinit var logView: TextView

    private var payPalClient: PayPalWebCheckoutClient? = null
    private var lastHandledReturnUri: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildContent())
        appendLog("Ready. Enter a client ID and a PayPal order ID from your backend, then tap Start Checkout.")
    }

    override fun onResume() {
        super.onResume()
        handleReturnIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleReturnIntent(intent)
    }

    private fun buildContent(): View {
        val scrollView = ScrollView(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(24))
            setBackgroundColor(Color.parseColor("#0E1117"))
        }

        scrollView.addView(
            container,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
        )

        container.addView(titleText("PayPal Mobile SDK Test"))
        container.addView(subtitleText("Native Android demo for PayPal Web Payments. Flutter cannot reuse this SDK package directly unless you add a Flutter plugin wrapper around the native SDK."))
        container.addView(sectionLabel("Client ID"))
        clientIdInput = createInput("Paste your Sandbox or Live client ID here")
        container.addView(clientIdInput)

        container.addView(sectionLabel("Order ID"))
        orderIdInput = createInput("Paste a PayPal order ID created by your backend")
        container.addView(orderIdInput)

        container.addView(sectionLabel("Return URL Scheme"))
        returnSchemeInput = createInput(getString(R.string.paypal_return_scheme)).apply {
            setText(getString(R.string.paypal_return_scheme))
        }
        container.addView(returnSchemeInput)

        container.addView(sectionLabel("Environment"))
        environmentSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_item,
                listOf("Sandbox", "Live")
            ).also { adapter ->
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            }
        }
        container.addView(environmentSpinner)

        val buttonRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(16), 0, dp(8))
        }

        val startButton = Button(this).apply {
            text = "Start Checkout"
            setOnClickListener { startCheckout() }
        }

        val clearButton = Button(this).apply {
            text = "Clear Log"
            setOnClickListener { logView.text = "" }
        }

        buttonRow.addView(
            startButton,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(8)
            }
        )
        buttonRow.addView(
            clearButton,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )
        container.addView(buttonRow)

        container.addView(sectionLabel("Log"))
        logView = TextView(this).apply {
            setTextColor(Color.parseColor("#D9E1F2"))
            textSize = 14f
            typeface = Typeface.MONOSPACE
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setBackgroundColor(Color.parseColor("#181C25"))
        }

        container.addView(
            logView,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(8)
            }
        )

        return scrollView
    }

    private fun startCheckout() {
        val clientId = clientIdInput.text.toString().trim()
        val orderId = orderIdInput.text.toString().trim()
        val returnScheme = returnSchemeInput.text.toString().trim()
        val environment = when (environmentSpinner.selectedItemPosition) {
            1 -> Environment.LIVE
            else -> Environment.SANDBOX
        }

        if (clientId.isBlank() || orderId.isBlank() || returnScheme.isBlank()) {
            appendLog("Client ID, order ID, and return scheme are required.")
            return
        }

        val coreConfig = CoreConfig(clientId = clientId, environment = environment)
        val client = PayPalWebCheckoutClient(this, coreConfig, returnScheme)
        payPalClient = client
        lastHandledReturnUri = null

        appendLog("Launching checkout for order $orderId in ${environment.name}.")

        val request = PayPalWebCheckoutRequest(
            orderId = orderId,
            fundingSource = PayPalWebCheckoutFundingSource.PAYPAL
        )

        client.start(this, request) { startResult ->
            when (startResult) {
                is PayPalPresentAuthChallengeResult.Success -> {
                    appendLog("Browser switch started successfully.")
                }

                is PayPalPresentAuthChallengeResult.Failure -> {
                    appendLog("Failed to start checkout: ${startResult.error.errorDescription}")
                }
            }
        }
    }

    private fun handleReturnIntent(intent: Intent) {
        val client = payPalClient ?: return
        val data = intent.data ?: return
        val currentScheme = returnSchemeInput.text.toString().trim()
        if (currentScheme.isBlank() || data.scheme != currentScheme) {
            return
        }

        val incomingUri = data.toString()
        if (incomingUri == lastHandledReturnUri) {
            return
        }
        lastHandledReturnUri = incomingUri

        appendLog("Return intent received: $incomingUri")

        when (val finishResult = client.finishStart(intent)) {
            is PayPalWebCheckoutFinishStartResult.Success -> {
                appendLog("Checkout success. orderId=${finishResult.orderId}, payerId=${finishResult.payerId}")
            }

            is PayPalWebCheckoutFinishStartResult.Failure -> {
                appendLog("Checkout failure: ${finishResult.error.errorDescription}")
            }

            is PayPalWebCheckoutFinishStartResult.Canceled -> {
                appendLog("Checkout canceled.")
            }

            PayPalWebCheckoutFinishStartResult.NoResult -> {
                appendLog("No checkout result was available for this return intent.")
            }

            else -> {
                appendLog("No result available.")
            }
        }
    }

    private fun createInput(hint: String): EditText {
        return EditText(this).apply {
            setTextColor(Color.WHITE)
            setHintTextColor(Color.parseColor("#8D96A8"))
            setBackgroundColor(Color.parseColor("#181C25"))
            setPadding(dp(14), dp(12), dp(14), dp(12))
            this.hint = hint
        }
    }

    private fun titleText(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            setTextColor(Color.WHITE)
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.START
            setPadding(0, 0, 0, dp(8))
        }
    }

    private fun subtitleText(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            setTextColor(Color.parseColor("#A9B4C7"))
            textSize = 14f
            setPadding(0, 0, 0, dp(20))
        }
    }

    private fun sectionLabel(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            setTextColor(Color.parseColor("#E6EBF5"))
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(12), 0, dp(8))
        }
    }

    private fun appendLog(message: String) {
        runOnUiThread {
            val line = if (logView.text.isNullOrBlank()) {
                message
            } else {
                "${logView.text}\n$message"
            }
            logView.text = line
        }
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }
}
