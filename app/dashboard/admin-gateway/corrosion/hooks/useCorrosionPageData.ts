import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGisEngine } from '@/store/gisEngine';
import { API } from '../constants';
import {
  CpAnalysis,
  CpCompareData,
  CpPipeline,
  Tab,
  UploadDetail,
  UploadRecord,
} from '../types';

export function useCorrosionPageData() {
  const setSvyCpOverlay = useGisEngine((s) => s.setSvyCpOverlay);

  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'specialist' | 'manager'>('specialist');

  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<UploadDetail | null>(null);
  const [uploadSearch, setUploadSearch] = useState('');
  const [uploadYear, setUploadYear] = useState<string>('all');
  const [uploadLocation, setUploadLocation] = useState('');

  const [cpPipelines, setCpPipelines] = useState<CpPipeline[]>([]);
  const [cpPipelinesLoading, setCpPipelinesLoading] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [selectedCpSession, setSelectedCpSession] = useState<string | null>(null);
  const [cpAnalysis, setCpAnalysis] = useState<CpAnalysis | null>(null);
  const [cpAnalysisLoading, setCpAnalysisLoading] = useState(false);
  const [segmentSize, setSegmentSize] = useState(100);

  const [compareSessionA, setCompareSessionA] = useState<string | null>(null);
  const [compareSessionB, setCompareSessionB] = useState<string | null>(null);
  const [compareSessionC, setCompareSessionC] = useState<string | null>(null);
  const [compareSessionD, setCompareSessionD] = useState<string | null>(null);
  const [cpCompareData, setCpCompareData] = useState<CpCompareData | null>(null);
  const [cpCompareLoading, setCpCompareLoading] = useState(false);

  const fetchUploads = useCallback(async () => {
    setUploadsLoading(true);
    try {
      const r = await fetch(`${API}/uploads?limit=200&offset=0`);
      if (r.ok) {
        const d = await r.json();
        setUploads(d.uploads ?? []);
      }
    } finally {
      setUploadsLoading(false);
    }
  }, []);

  const fetchCpPipelines = useCallback(async () => {
    setCpPipelinesLoading(true);
    try {
      const r = await fetch(`${API}/cp-pipelines?page=1&page_size=120&include_sessions=true`);
      if (r.ok) {
        const d = await r.json();
        setCpPipelines(d.pipelines ?? []);
      }
    } finally {
      setCpPipelinesLoading(false);
    }
  }, []);

  const fetchCpAnalysis = useCallback(
    async (sessionId: string, size?: number) => {
      setCpAnalysisLoading(true);
      setCpAnalysis(null);
      try {
        const sz = size ?? segmentSize;
        const r = await fetch(
          `${API}/cp-analysis/${sessionId}?segment_size=${sz}&include_chart_data=true&include_gis_points=true`
        );
        if (r.ok) {
          const data = await r.json();
          setCpAnalysis(data);

          const gisPoints = Array.isArray(data?.session?.gis_points) ? data.session.gis_points : [];
          if (gisPoints.length > 0) {
            const applyOverlay = () => {
              setSvyCpOverlay({
                sessionId: data?.session?.session_id ?? null,
                filename: data?.session?.file_name ?? '',
                pipelineId: data?.session?.pipeline_id ?? null,
                surveyDate: data?.session?.survey_date ?? null,
                features: gisPoints,
              });
            };

            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
              (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(applyOverlay);
            } else {
              setTimeout(applyOverlay, 0);
            }
          }
        }
      } finally {
        setCpAnalysisLoading(false);
      }
    },
    [segmentSize, setSvyCpOverlay]
  );

  const fetchCpCompare = useCallback(
    async (a: string, b: string, c?: string | null, d?: string | null, size?: number) => {
      setCpCompareLoading(true);
      setCpCompareData(null);
      try {
        const sz = size ?? segmentSize;
        let url = `${API}/cp-compare?session_a=${a}&session_b=${b}&segment_size=${sz}&include_combined_chart=true`;
        if (c) url += `&session_c=${c}`;
        if (d) url += `&session_d=${d}`;
        const r = await fetch(url);
        if (r.ok) setCpCompareData(await r.json());
      } finally {
        setCpCompareLoading(false);
      }
    },
    [segmentSize]
  );

  const fetchUploadDetail = useCallback(async (id: string) => {
    const r = await fetch(`${API}/uploads/${id}`);
    if (r.ok) setSelectedUpload(await r.json());
  }, []);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchUploads();
      fetchCpPipelines();
    }
    if (activeTab === 'analysis') fetchCpPipelines();
    if (activeTab === 'segments') fetchCpPipelines();
    if (activeTab === 'compare') fetchCpPipelines();
    if (activeTab === 'prediction') fetchCpPipelines();
  }, [activeTab, fetchUploads, fetchCpPipelines]);

  useEffect(() => {
    if (selectedCpSession) fetchCpAnalysis(selectedCpSession, segmentSize);
  }, [selectedCpSession, segmentSize, fetchCpAnalysis]);

  useEffect(() => {
    if (compareSessionA && compareSessionB) {
      fetchCpCompare(compareSessionA, compareSessionB, compareSessionC, compareSessionD, segmentSize);
    }
  }, [compareSessionA, compareSessionB, compareSessionC, compareSessionD, segmentSize, fetchCpCompare]);

  const filteredUploads = useMemo(() => {
    const q = uploadSearch.trim().toLowerCase();
    const loc = uploadLocation.trim().toLowerCase();

    const getYear = (u: UploadRecord) => {
      if (!u.survey_date) return '';
      const dt = new Date(u.survey_date);
      return Number.isNaN(dt.getTime()) ? '' : String(dt.getFullYear());
    };

    return uploads
      .filter((u) => {
        const session = cpPipelines.flatMap((p) => p.sessions).find((s) => s.file_name === u.filename);
        const year = getYear(u);
        const distanceRange =
          session?.start_distance != null ? `${session.start_distance} ${session.end_distance ?? ''}` : '';
        const locationText = `${u.pipeline_id ?? ''} ${distanceRange}`.toLowerCase();

        const matchQ = !q || `${u.filename} ${u.pipeline_id ?? ''}`.toLowerCase().includes(q);
        const matchYear = uploadYear === 'all' || year === uploadYear;
        const matchLoc = !loc || locationText.includes(loc);
        return matchQ && matchYear && matchLoc;
      })
      .sort((a, b) => {
        const da = a.survey_date ? new Date(a.survey_date).getTime() : 0;
        const db = b.survey_date ? new Date(b.survey_date).getTime() : 0;
        return da - db;
      });
  }, [uploads, cpPipelines, uploadSearch, uploadYear, uploadLocation]);

  return {
    activeTab,
    setActiveTab,
    showUploadPanel,
    setShowUploadPanel,
    viewMode,
    setViewMode,
    uploads,
    uploadsLoading,
    selectedUpload,
    setSelectedUpload,
    uploadSearch,
    setUploadSearch,
    uploadYear,
    setUploadYear,
    uploadLocation,
    setUploadLocation,
    cpPipelines,
    cpPipelinesLoading,
    selectedPipeline,
    setSelectedPipeline,
    selectedCpSession,
    setSelectedCpSession,
    cpAnalysis,
    setCpAnalysis,
    cpAnalysisLoading,
    segmentSize,
    setSegmentSize,
    compareSessionA,
    setCompareSessionA,
    compareSessionB,
    setCompareSessionB,
    compareSessionC,
    setCompareSessionC,
    compareSessionD,
    setCompareSessionD,
    cpCompareData,
    setCpCompareData,
    cpCompareLoading,
    filteredUploads,
    fetchUploads,
    fetchCpPipelines,
    fetchCpAnalysis,
    fetchCpCompare,
    fetchUploadDetail,
  };
}
