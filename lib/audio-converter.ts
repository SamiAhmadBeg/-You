/**
 * Audio format conversion utilities for Twilio and AssemblyAI integration
 * 
 * Twilio sends: mulaw, 8kHz, base64-encoded
 * AssemblyAI expects: PCM 16-bit, 16kHz
 * Fish Audio returns: MP3
 */

/**
 * Convert mulaw audio to PCM 16-bit
 * @param mulawData - Buffer containing mulaw audio data
 * @returns Buffer containing PCM 16-bit audio data
 */
export function mulawToPCM(mulawData: Buffer): Buffer {
  const pcmData = Buffer.alloc(mulawData.length * 2) // 16-bit = 2 bytes per sample

  for (let i = 0; i < mulawData.length; i++) {
    const mulawByte = mulawData[i]
    const pcmSample = mulawDecode(mulawByte)
    pcmData.writeInt16LE(pcmSample, i * 2)
  }

  return pcmData
}

/**
 * Decode a single mulaw byte to PCM 16-bit sample
 */
function mulawDecode(mulawByte: number): number {
  const MULAW_BIAS = 33
  const MULAW_MAX = 0x1fff

  mulawByte = ~mulawByte
  const sign = mulawByte & 0x80
  const exponent = (mulawByte >> 4) & 0x07
  const mantissa = mulawByte & 0x0f

  let sample = mantissa << (exponent + 3)
  sample += MULAW_BIAS << exponent

  if (sample > MULAW_MAX) sample = MULAW_MAX

  return sign ? -sample : sample
}

/**
 * Convert PCM 16-bit to mulaw
 * @param pcmData - Buffer containing PCM 16-bit audio data
 * @returns Buffer containing mulaw audio data
 */
export function pcmToMulaw(pcmData: Buffer): Buffer {
  const mulawData = Buffer.alloc(pcmData.length / 2)

  for (let i = 0; i < mulawData.length; i++) {
    const pcmSample = pcmData.readInt16LE(i * 2)
    mulawData[i] = mulawEncode(pcmSample)
  }

  return mulawData
}

/**
 * Encode a PCM 16-bit sample to mulaw byte
 */
function mulawEncode(pcmSample: number): number {
  const MULAW_MAX = 0x1fff
  const MULAW_BIAS = 33

  const sign = pcmSample < 0 ? 0x80 : 0x00
  let magnitude = Math.abs(pcmSample)

  if (magnitude > MULAW_MAX) magnitude = MULAW_MAX

  magnitude += MULAW_BIAS

  let exponent = 7
  for (let i = 0x2000; i > magnitude; i >>= 1) exponent--

  const mantissa = (magnitude >> (exponent + 3)) & 0x0f
  const mulawByte = ~(sign | (exponent << 4) | mantissa)

  return mulawByte & 0xff
}

/**
 * Resample audio from 8kHz to 16kHz using linear interpolation
 * @param pcm8khz - PCM 16-bit audio at 8kHz
 * @returns PCM 16-bit audio at 16kHz
 */
export function resample8kTo16k(pcm8khz: Buffer): Buffer {
  const inputSamples = pcm8khz.length / 2
  const outputSamples = inputSamples * 2 // Double the sample rate
  const output = Buffer.alloc(outputSamples * 2)

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i / 2
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1)
    const fraction = srcIndex - srcIndexFloor

    const sample1 = pcm8khz.readInt16LE(srcIndexFloor * 2)
    const sample2 = pcm8khz.readInt16LE(srcIndexCeil * 2)

    // Linear interpolation
    const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction)

    output.writeInt16LE(interpolated, i * 2)
  }

  return output
}

/**
 * Convert Twilio audio (mulaw, 8kHz, base64) to AssemblyAI format (PCM 16-bit, 16kHz)
 * @param base64Mulaw - Base64-encoded mulaw audio from Twilio
 * @returns PCM 16-bit audio at 16kHz
 */
export function twilioToAssemblyAI(base64Mulaw: string): Buffer {
  // Decode base64
  const mulawBuffer = Buffer.from(base64Mulaw, "base64")

  // Convert mulaw to PCM
  const pcm8khz = mulawToPCM(mulawBuffer)

  // Resample from 8kHz to 16kHz
  const pcm16khz = resample8kTo16k(pcm8khz)

  return pcm16khz
}

/**
 * Convert audio buffer to base64-encoded mulaw for Twilio
 * @param pcmData - PCM 16-bit audio data
 * @param sampleRate - Current sample rate of the audio (will be resampled to 8kHz if needed)
 * @returns Base64-encoded mulaw audio
 */
export function audioToTwilio(pcmData: Buffer, sampleRate: number = 24000): string {
  let pcm8khz = pcmData

  // Resample to 8kHz if needed
  if (sampleRate === 16000) {
    pcm8khz = downsample16kTo8k(pcmData)
  } else if (sampleRate === 24000) {
    pcm8khz = downsample24kTo8k(pcmData)
  } else if (sampleRate === 44100) {
    pcm8khz = downsample44kTo8k(pcmData)
  }

  // Convert PCM to mulaw
  const mulawBuffer = pcmToMulaw(pcm8khz)

  // Encode to base64
  return mulawBuffer.toString("base64")
}

/**
 * Downsample audio from 44.1kHz to 8kHz (Fish Audio WAV output)
 * @param pcm44khz - PCM 16-bit audio at 44.1kHz
 * @returns PCM 16-bit audio at 8kHz
 */
function downsample44kTo8k(pcm44khz: Buffer): Buffer {
  const inputSamples = pcm44khz.length / 2
  const ratio = 44100 / 8000 // ~5.5125
  const outputSamples = Math.floor(inputSamples / ratio)
  const output = Buffer.alloc(outputSamples * 2)

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1)
    const fraction = srcIndex - srcIndexFloor

    const sample1 = pcm44khz.readInt16LE(srcIndexFloor * 2)
    const sample2 = pcm44khz.readInt16LE(srcIndexCeil * 2)

    // Linear interpolation
    const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction)
    output.writeInt16LE(interpolated, i * 2)
  }

  return output
}

/**
 * Downsample audio from 24kHz to 8kHz (OpenAI TTS output)
 * Uses linear interpolation for better quality
 * @param pcm24khz - PCM 16-bit audio at 24kHz
 * @returns PCM 16-bit audio at 8kHz
 */
function downsample24kTo8k(pcm24khz: Buffer): Buffer {
  const inputSamples = pcm24khz.length / 2
  const ratio = 24000 / 8000 // 3.0
  const outputSamples = Math.floor(inputSamples / ratio)
  const output = Buffer.alloc(outputSamples * 2)

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1)
    const fraction = srcIndex - srcIndexFloor

    const sample1 = pcm24khz.readInt16LE(srcIndexFloor * 2)
    const sample2 = pcm24khz.readInt16LE(srcIndexCeil * 2)

    // Linear interpolation
    const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction)
    output.writeInt16LE(interpolated, i * 2)
  }

  return output
}

/**
 * Downsample audio from 16kHz to 8kHz
 * Uses linear interpolation for better quality
 * @param pcm16khz - PCM 16-bit audio at 16kHz
 * @returns PCM 16-bit audio at 8kHz
 */
function downsample16kTo8k(pcm16khz: Buffer): Buffer {
  const inputSamples = pcm16khz.length / 2
  const ratio = 16000 / 8000 // 2.0
  const outputSamples = Math.floor(inputSamples / ratio)
  const output = Buffer.alloc(outputSamples * 2)

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1)
    const fraction = srcIndex - srcIndexFloor

    const sample1 = pcm16khz.readInt16LE(srcIndexFloor * 2)
    const sample2 = pcm16khz.readInt16LE(srcIndexCeil * 2)

    // Linear interpolation
    const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction)
    output.writeInt16LE(interpolated, i * 2)
  }

  return output
}

/**
 * Downsample audio from 48kHz to 8kHz
 * @param pcm48khz - PCM 16-bit audio at 48kHz
 * @returns PCM 16-bit audio at 8kHz
 */
function downsample48kTo8k(pcm48khz: Buffer): Buffer {
  const inputSamples = pcm48khz.length / 2
  const outputSamples = Math.floor(inputSamples / 6) // 48kHz → 8kHz = divide by 6
  const output = Buffer.alloc(outputSamples * 2)

  for (let i = 0; i < outputSamples; i++) {
    const sample = pcm48khz.readInt16LE(i * 12) // Take every 6th sample
    output.writeInt16LE(sample, i * 2)
  }

  return output
}

