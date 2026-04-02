interface ProcessInput  { filePath?: string; text?: string }
interface ProcessResult { filePath?: string; text?: string }
interface ProcessContext {
  workspaceDir: string
  tempDir:      string
  log:          (msg: string) => void
  progress:     (pct: number, label: string) => void
}
interface Params {
  style:   string
  quality: string
}

const STYLE_KEYWORDS: Record<string, string> = {
  photorealistic: 'photorealistic, highly detailed, realistic materials',
  stylized:       'stylized, artistic, vibrant colors',
  'low-poly':     'low poly, minimal geometry, flat shading',
}

const QUALITY_KEYWORDS: Record<string, string> = {
  high:   'high quality, 4K textures, professional render',
  medium: 'good quality',
}

const process = async (
  input:   ProcessInput,
  params:  Params,
  context: ProcessContext,
): Promise<ProcessResult> => {
  context.progress(30, 'Analyzing prompt…')

  const base    = (input.text ?? '').trim()
  const parts   = [base]
  const style   = STYLE_KEYWORDS[params.style]
  const quality = QUALITY_KEYWORDS[params.quality]

  if (style)   parts.push(style)
  if (quality) parts.push(quality)

  context.progress(80, 'Building enhanced prompt…')

  const enhanced = parts.filter(Boolean).join(', ')
  context.log(`Enhanced: "${enhanced}"`)
  context.progress(100, 'Done')

  return { text: enhanced }
}

export = process
