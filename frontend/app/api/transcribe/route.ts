// app/api/transcribe/route.ts
import { NextResponse } from 'next/server'
import { writeFileSync, unlinkSync } from 'fs'
import { spawnSync } from 'child_process'
import path from 'path'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { audioBlob } = await request.json()
  if (!audioBlob) {
    return NextResponse.json({ error: 'no audioBlob provided' }, { status: 400 })
  }

  // 1) split off the "data:*;base64," prefix
  const [meta, base64] = audioBlob.split(',', 2)
  if (!base64) {
    return NextResponse.json({ error: 'invalid data URL' }, { status: 400 })
  }

  // figure out extension (e.g. webm or ogg)
  const extMatch = meta.match(/audio\/([^;]+)/)
  const inputExt = extMatch ? extMatch[1] : 'webm'
  const tmpInput  = path.join(process.cwd(), `tmp_audio.${inputExt}`)
  const tmpWav    = path.join(process.cwd(), `tmp_audio.wav`)

  // 2) write raw base64 into tmp_input
  writeFileSync(tmpInput, Buffer.from(base64, 'base64'))

  // 3) ffmpeg → 16 kHz mono wav
  const ff = spawnSync('ffmpeg', [
    '-y',
    '-i', tmpInput,
    '-ac', '1',
    '-ar', '16000',
    tmpWav
  ], { encoding: 'utf8' })

  if (ff.error || ff.status !== 0) {
    console.error('ffmpeg error', ff.stderr || ff.error)
    // cleanup
    unlinkSync(tmpInput)
    return NextResponse.json({ error: 'ffmpeg failed' }, { status: 500 })
  }

  // 4) call Python
  const py = spawnSync('python', ['scripts/transcribe.py', tmpWav], {
    encoding: 'utf8'
  })
  if (py.error) {
    console.error('Python spawn error', py.error)
    unlinkSync(tmpInput); unlinkSync(tmpWav)
    return NextResponse.json({ error: py.error.message }, { status: 500 })
  }

  // parse JSON from Whisper
  let out: any
  try {
    out = JSON.parse(py.stdout)
  } catch (e) {
    console.error('bad JSON from Python:', py.stdout)
    unlinkSync(tmpInput); unlinkSync(tmpWav)
    return NextResponse.json({ error: 'invalid JSON from transcription' }, { status: 500 })
  }

  // cleanup
  unlinkSync(tmpInput)
  unlinkSync(tmpWav)

  return NextResponse.json(out)
}
