import { create } from 'zustand';

interface InSARJob {
  id?: string;
  job_id?: string;
  name: string;
  status?: string;
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
}

interface InSARStore {
  selectedJob: InSARJob | null;
  selectedResult: any | null;
  results: any | null;
  isLoading: boolean;
  error: string | null;
  setSelectedResult: (result: any | null) => void;
  setSelectedJob: (job: InSARJob) => Promise<any | null>;
}

export const useInSarStore = create<InSARStore>((set) => ({
  selectedJob: null,
  selectedResult: null,
  results: null,
  isLoading: false,
  error: null,

  setSelectedResult: (result: any | null) => set({ selectedResult: result, results: result }),

  setSelectedJob: async (job: InSARJob) => {
    set({ selectedJob: job, isLoading: true, error: null });
    try {
      const jobId = job.id || job.job_id;
      const res = await fetch('/api/gis/insar-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          name: job.name,
          bbox: job.bbox,
          polygon: job.polygon,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.message_ar || data?.error || 'تعذر تحميل نتائج InSAR.';
        set({ isLoading: false, error: msg });
        return null;
      }
      if (data.ok) {
        set({ selectedResult: data, results: data, isLoading: false, error: null });
        return data;
      } else {
        const msg = data?.message_ar || data?.error || 'نتائج InSAR غير متاحة حالياً.';
        set({ isLoading: false, error: msg });
        return null;
      }
    } catch (error) {
      console.error('Error fetching InSAR results:', error);
      set({ isLoading: false, error: 'تعذر تحميل نتائج InSAR. حاول مرة أخرى.' });
      return null;
    }
  },
}));
