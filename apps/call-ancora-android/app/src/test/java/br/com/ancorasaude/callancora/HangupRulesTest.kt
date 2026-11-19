package br.com.ancorasaude.callancora

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HangupRulesTest {
    private val defaults = HangupConfig()

    @Test
    fun ringTimeoutDisconnectsAsNoAnswer() {
        assertNull(HangupRules.onStillDialing(21_999, defaults))
        val decision = HangupRules.onStillDialing(22_000, defaults)
        assertEquals(AutoOutcome.NO_ANSWER, decision?.outcome)
        assertEquals("ring_timeout", decision?.rule)
    }

    @Test
    fun quickActiveIsProbableVoicemail() {
        val decision = HangupRules.onActive(1_500, defaults)
        assertEquals(AutoOutcome.VOICEMAIL, decision?.outcome)
        assertEquals("quick_active", decision?.rule)
        assertEquals(1_500L, decision?.dialToActiveMs)
    }

    @Test
    fun normalAnswerIsKept() {
        assertNull(HangupRules.onActive(4_000, defaults))
        assertNull(HangupRules.onActive(12_000, defaults))
        assertNull(HangupRules.onActive(24_999, defaults))
    }

    @Test
    fun lateActiveIsProbableVoicemail() {
        val decision = HangupRules.onActive(25_000, defaults.copy(ringTimeoutSec = 40))
        assertEquals("late_active", decision?.rule)
    }

    @Test
    fun masterSwitchOffDoesNothing() {
        val off = defaults.copy(enabled = false)
        assertNull(HangupRules.onStillDialing(60_000, off))
        assertNull(HangupRules.onActive(500, off))
    }

    @Test
    fun valuesAreClampedToAllowedRanges() {
        val wild = HangupConfig(ringTimeoutSec = 5, quickActiveSec = 20, voicemailAfterSec = 200).clamped()
        assertEquals(15, wild.ringTimeoutSec)
        assertEquals(8, wild.quickActiveSec)
        assertEquals(60, wild.voicemailAfterSec)
        // Tempo de toque abaixo da faixa vira 15 s.
        assertEquals("ring_timeout", HangupRules.onStillDialing(15_000, HangupConfig(ringTimeoutSec = 3))?.rule)
    }

    @Test
    fun manualVoicemailKeepsTiming() {
        val decision = HangupRules.manualVoicemail("manual", 9_000)
        assertEquals(AutoOutcome.VOICEMAIL, decision.outcome)
        assertEquals(true, decision.isManual)
    }
}
