import { useCallback, useRef } from 'react'
import { useAppStore } from '@shared/stores/appStore'
import { useCollectionsStore } from '@shared/stores/collectionsStore'
import { useApi } from './useApi'

export function useGeneration() {
  const { currentJob, setCurrentJob, updateCurrentJob, generationOptions, selectedImageData } = useAppStore()
  const addToWorkspace = useCollectionsStore((s) => s.addToWorkspace)
  const activeCollectionId = useCollectionsStore((s) => s.activeCollectionId)
  const { generateFromImage, pollJobStatus, cancelJob } = useApi()
  const cancelledRef = useRef(false)

  const startGeneration = useCallback(
    async (imagePath: string) => {
      cancelledRef.current = false
      const job = {
        id: crypto.randomUUID(),
        imageFile: imagePath,
        status: 'uploading' as const,
        progress: 0,
        createdAt: Date.now(),
        modelId: generationOptions.modelId,
        generationOptions,
      }
      setCurrentJob(job)

      try {
        const { jobId } = await generateFromImage(imagePath, generationOptions, activeCollectionId, selectedImageData ?? undefined)

        if (cancelledRef.current) {
          await cancelJob(jobId)
          return
        }

        updateCurrentJob({ status: 'generating', progress: 0 })

        await pollUntilDone(jobId)
      } catch (err) {
        if (cancelledRef.current) return
        updateCurrentJob({
          status: 'error',
          error: err instanceof Error ? err.message : String(err)
        })
      }
    },
    [generateFromImage, pollJobStatus, cancelJob, setCurrentJob, updateCurrentJob, addToWorkspace, activeCollectionId]
  )

  const pollUntilDone = async (jobId: string) => {
    while (true) {
      await new Promise((r) => setTimeout(r, 1000))

      if (cancelledRef.current) {
        await cancelJob(jobId)
        setCurrentJob(null)
        break
      }

      const result = await pollJobStatus(jobId)

      if (result.status === 'cancelled') {
        setCurrentJob(null)
        break
      }

      if (result.status === 'done') {
        updateCurrentJob({ status: 'done', progress: 100, outputUrl: result.outputUrl, originalOutputUrl: result.outputUrl })
        const finalJob = useAppStore.getState().currentJob
        if (finalJob) addToWorkspace(finalJob)
        break
      }

      if (result.status === 'error') {
        updateCurrentJob({ status: 'error', error: result.error })
        break
      }

      updateCurrentJob({
        progress: result.progress,
        step: result.step,
      })
    }
  }

  const cancelGeneration = useCallback(() => {
    cancelledRef.current = true
  }, [])

  const reset = useCallback(() => setCurrentJob(null), [setCurrentJob])

  return { currentJob, startGeneration, cancelGeneration, reset }
}
