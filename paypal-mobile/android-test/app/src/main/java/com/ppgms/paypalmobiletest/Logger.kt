package com.ppgms.paypalmobiletest

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.View
import android.widget.ScrollView
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 统一的日志输出器, 把 UI/API/SDK 事件追加到 TextView 中。
 *
 * 每行格式: `HH:mm:ss.SSS  [TAG]  message`
 * - 时间戳灰色
 * - TAG 根据类型上色 (UI 绿 / API 蓝 / SDK 黄 / ERR 红 / INF 灰)
 * - 自动滚动到底部
 *
 * 所有方法都做了线程切换, 后台线程也能直接调用。
 */
class Logger(
    private val view: TextView,
    private val scrollHost: ScrollView,
    private val activity: Activity,
) {

    enum class Tag(val display: String, val color: Int) {
        UI("UI ", Color.parseColor("#86EFAC")),
        API("API", Color.parseColor("#7DD3FC")),
        SDK("SDK", Color.parseColor("#FCD34D")),
        ERR("ERR", Color.parseColor("#FCA5A5")),
        INFO("INF", Color.parseColor("#94A3B8")),
    }

    // SimpleDateFormat 在多线程下不安全, 加锁保护
    private val timeFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    private val lock = Any()

    fun ui(message: String) = log(Tag.UI, message)
    fun api(message: String) = log(Tag.API, message)
    fun sdk(message: String) = log(Tag.SDK, message)
    fun err(message: String) = log(Tag.ERR, message)
    fun info(message: String) = log(Tag.INFO, message)

    fun clear() {
        activity.runOnUiThread { view.text = "" }
    }

    private fun log(tag: Tag, message: String) {
        val timestamp = synchronized(lock) { timeFormat.format(Date()) }
        activity.runOnUiThread {
            val ssb = SpannableStringBuilder()
            if (view.text.isNotEmpty()) {
                ssb.append(view.text)
                ssb.append("\n")
            }
            val lineStart = ssb.length
            ssb.append(timestamp)
            ssb.append("  [")
            val tagStart = ssb.length
            ssb.append(tag.display)
            val tagEnd = ssb.length
            ssb.append("]  ")
            ssb.append(message)

            // 时间戳灰色
            ssb.setSpan(
                ForegroundColorSpan(Color.parseColor("#64748B")),
                lineStart,
                lineStart + timestamp.length,
                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            // TAG 上色 + 加粗
            ssb.setSpan(
                ForegroundColorSpan(tag.color),
                tagStart,
                tagEnd,
                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            ssb.setSpan(
                StyleSpan(Typeface.BOLD),
                tagStart,
                tagEnd,
                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            view.text = ssb
            // 内容追加完后, 让外层 ScrollView 滚到最底
            scrollHost.post { scrollHost.fullScroll(View.FOCUS_DOWN) }
        }
    }
}
