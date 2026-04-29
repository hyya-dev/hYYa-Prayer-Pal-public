package com.hyya.prayerpal.wear

import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.clickable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlin.math.max
import kotlin.math.min

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PrayerPalWearApp()
        }
    }
}

private object WatchLayout {
    const val BASE_WIDTH = 324f
    const val BASE_HEIGHT = 394f
    const val TITLE_BAND_CENTER_Y = 58f

    const val TEMP_TOP = 60f
    const val TEMP_LEADING = 44f
    const val TEMP_FONT = 24f

    const val PRAYER_GAP = 2f
    const val PRAYER_FONT = 16f
    const val PRAYER_HORIZONTAL = 12f
    const val PRAYER_BOTTOM = 92f

    const val COUNTER_TOP = 137f
    const val COUNTER_FONT = 63f

    const val BUTTONS_TOP = 183f
    const val BUTTON_SIZE = 74f
    const val BUTTON_RESET_SIZE = 50f
    const val BUTTON_GAP = 30f
}

private data class WatchScale(
    val x: Float,
    val y: Float,
    val text: Float,
    val safeInsetX: Float,
    val safeInsetY: Float,
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PrayerPalWearApp(viewModel: WatchViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val pagerState = rememberPagerState(pageCount = { 2 })

    HorizontalPager(
        state = pagerState,
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) { page ->
        WatchFrame { scale ->
            when (page) {
                0 -> MainScreen(uiState, scale)
                1 -> CounterScreen(scale, uiState.appTitle)
            }
        }
    }
}

@Composable
private fun WatchFrame(content: @Composable (WatchScale) -> Unit) {
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val diameter = if (maxWidth < maxHeight) maxWidth else maxHeight
        val scale = WatchScale(
            x = diameter.value / WatchLayout.BASE_WIDTH,
            y = diameter.value / WatchLayout.BASE_HEIGHT,
            text = diameter.value / WatchLayout.BASE_WIDTH,
            safeInsetX = diameter.value * 0.07f,
            safeInsetY = diameter.value * 0.08f,
        )

        Box(
            modifier = Modifier
                .size(diameter)
                .background(Color.Black)
                .clip(CircleShape)
                .align(Alignment.Center),
        ) {
            content(scale)
        }
    }
}

@Composable
private fun WearTopTitle(scale: WatchScale, title: String) {
    Text(
        text = title,
        color = Color.White,
        fontWeight = FontWeight.SemiBold,
        fontSize = (13f * scale.text).sp,
        textAlign = TextAlign.Center,
        maxLines = 1,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = (WatchLayout.TITLE_BAND_CENTER_Y * scale.y + scale.safeInsetY * 0.12f).dp),
    )
}

@Composable
private fun MainScreen(uiState: WatchUiState, scale: WatchScale) {
    Box(modifier = Modifier.fillMaxSize()) {
        WearTopTitle(scale, uiState.appTitle)

        if (uiState.isWaitingForPhone) {
            Text(
                text = uiState.waitingText,
                color = Color.White,
                fontSize = (12f * scale.text).sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = (18f * scale.y + scale.safeInsetY * 0.35f).dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.Black.copy(alpha = 0.45f))
                    .padding(horizontal = (10f * scale.x).dp, vertical = (6f * scale.y).dp),
            )
        }

        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(
                modifier = Modifier.size(
                    width = 0.dp,
                    height = (118f * scale.y + scale.safeInsetY * 0.35f).dp,
                )
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = (WatchLayout.PRAYER_HORIZONTAL * scale.x + scale.safeInsetX * 0.6f).dp),
                verticalArrangement = Arrangement.spacedBy((WatchLayout.PRAYER_GAP * scale.y).dp),
            ) {
                uiState.prayerEntries.forEach { entry ->
                    val isNext = entry.key == uiState.nextPrayerKey
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = (25f * scale.y).dp)
                            .clip(RoundedCornerShape((4f * scale.x).dp))
                            .background(if (isNext) Color(0x66FF8A00) else Color.Transparent)
                            .padding(horizontal = (16f * scale.x).dp, vertical = if (isNext) (2f * scale.y).dp else 0.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = entry.label,
                            color = Color.White,
                            fontSize = (WatchLayout.PRAYER_FONT * scale.text).sp,
                            lineHeight = (WatchLayout.PRAYER_FONT * scale.text).sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                        )
                        Text(
                            text = entry.time,
                            color = Color.White,
                            fontSize = (WatchLayout.PRAYER_FONT * scale.text).sp,
                            lineHeight = (WatchLayout.PRAYER_FONT * scale.text).sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.End,
                            maxLines = 1,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Text(
                text = uiState.temperature,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = (WatchLayout.TEMP_FONT * scale.text).sp,
            )

            Spacer(
                modifier = Modifier.size(
                    width = 0.dp,
                    height = (44f * scale.y + scale.safeInsetY * 0.15f).dp,
                )
            )
        }
    }
}

@Composable
private fun CounterScreen(scale: WatchScale, title: String) {
    var count by remember { mutableIntStateOf(0) }
    val context = LocalContext.current

    // Light tap for increment/decrement (matches Apple Watch .click)
    val vibrateClick = remember(context) {
        {
            try {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val manager = context.getSystemService(VibratorManager::class.java)
                    manager?.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    context.getSystemService(Vibrator::class.java)
                }

                if (vibrator?.hasVibrator() == true) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(
                            VibrationEffect.createOneShot(
                                16L,
                                VibrationEffect.DEFAULT_AMPLITUDE
                            )
                        )
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(16L)
                    }
                }
            } catch (_: SecurityException) {
                // Permission not granted – silently ignore
            }
        }
    }

    // Stronger notification-style haptic for reset (matches Apple Watch .notification)
    val vibrateReset = remember(context) {
        {
            try {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val manager = context.getSystemService(VibratorManager::class.java)
                    manager?.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    context.getSystemService(Vibrator::class.java)
                }

                if (vibrator?.hasVibrator() == true) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        // Double-pulse pattern: vibrate 40ms, pause 80ms, vibrate 40ms
                        vibrator.vibrate(
                            VibrationEffect.createWaveform(
                                longArrayOf(0L, 40L, 80L, 40L),
                                intArrayOf(
                                    0,
                                    VibrationEffect.DEFAULT_AMPLITUDE,
                                    0,
                                    VibrationEffect.DEFAULT_AMPLITUDE
                                ),
                                -1, // no repeat
                            )
                        )
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(longArrayOf(0L, 40L, 80L, 40L), -1)
                    }
                }
            } catch (_: SecurityException) {
                // Permission not granted – silently ignore
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        WearTopTitle(scale, title)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = (WatchLayout.COUNTER_TOP * scale.y).dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top,
        ) {
            Text(
                text = count.toString().padStart(3, '0'),
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                fontSize = (WatchLayout.COUNTER_FONT * scale.text).sp,
            )

            Spacer(
                modifier = Modifier.size(
                    width = 0.dp,
                    height = max(
                        0f,
                        WatchLayout.BUTTONS_TOP - WatchLayout.COUNTER_TOP - WatchLayout.COUNTER_FONT,
                    ).times(scale.y).dp,
                )
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy((WatchLayout.BUTTON_GAP * scale.x).dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size((WatchLayout.BUTTON_SIZE * scale.x).dp)
                        .background(Color.Black.copy(alpha = 0.4f), CircleShape)
                        .clip(CircleShape)
                        .clickable(role = Role.Button) {
                            if (count > 0) {
                                count -= 1
                                vibrateClick()
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Remove,
                        contentDescription = stringResource(R.string.watch_decrement),
                        tint = if (count > 0) Color.White else Color.White.copy(alpha = 0.3f),
                        modifier = Modifier.size((WatchLayout.BUTTON_SIZE * 0.4f * scale.x).dp),
                    )
                }

                Box(
                    modifier = Modifier
                        .size((WatchLayout.BUTTON_RESET_SIZE * scale.x).dp)
                        .background(Color.Black.copy(alpha = 0.4f), CircleShape)
                        .clip(CircleShape)
                        .clickable(role = Role.Button) {
                            if (count > 0) {
                                count = 0
                                vibrateReset()
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.RestartAlt,
                        contentDescription = stringResource(R.string.watch_reset),
                        tint = if (count > 0) Color.White else Color.White.copy(alpha = 0.3f),
                        modifier = Modifier.size((WatchLayout.BUTTON_RESET_SIZE * 0.35f * scale.x).dp),
                    )
                }

                Box(
                    modifier = Modifier
                        .size((WatchLayout.BUTTON_SIZE * scale.x).dp)
                        .background(Color(0x99FF8A00), CircleShape)
                        .clip(CircleShape)
                        .clickable(role = Role.Button) {
                            if (count < 999) {
                                count += 1
                                vibrateClick()
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Add,
                        contentDescription = stringResource(R.string.watch_increment),
                        tint = Color.White,
                        modifier = Modifier.size((WatchLayout.BUTTON_SIZE * 0.4f * scale.x).dp),
                    )
                }
            }
        }
    }
}
