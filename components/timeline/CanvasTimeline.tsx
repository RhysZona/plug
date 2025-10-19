import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { DiarizationSegment, SpeakerMap } from '../../types';

// --- COMPONENT CONSTANTS ---
const TRACK_HEIGHT = 12;
const TRACK_GAP = 2;
const TIMESCALE_HEIGHT = 20;

// --- PROPS INTERFACE ---
interface CanvasTimelineProps {
    segments: DiarizationSegment[];
    speakerMap: SpeakerMap;
    duration: number;
    currentTime: number;
    onSeek: (time: number) => void;
    zoomLevel: number;
    selectedSegment: DiarizationSegment | null;
    onSelectSegment: (segment: DiarizationSegment | null) => void;
}

// --- HOVER STATE TYPE ---
interface HoveredSegment {
    segment: DiarizationSegment;
    x: number;
    y: number;
}

// --- HELPER FUNCTIONS ---

const getNiceInterval = (duration: number, totalWidth: number): number => {
    if (!totalWidth || !duration || duration <= 0) return 60;
    const minMarkerGapPx = 90;
    const timePerPixel = duration / totalWidth;
    const minTimeInterval = timePerPixel * minMarkerGapPx;
    const niceIntervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
    return niceIntervals.find(interval => interval >= minTimeInterval) || niceIntervals[niceIntervals.length - 1];
};

const formatTimeMarker = (timeInSeconds: number): string => {
    const date = new Date(timeInSeconds * 1000);
    const hours = date.getUTCHours();
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    if (hours > 0) {
        return `${String(hours)}:${minutes}:${seconds}`;
    }
    return `${minutes}:${seconds}`;
};


export const CanvasTimeline: React.FC<CanvasTimelineProps> = ({ segments, speakerMap, duration, currentTime, onSeek, zoomLevel, selectedSegment, onSelectSegment }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredSegment, setHoveredSegment] = useState<HoveredSegment | null>(null);
    const clickTimeoutRef = useRef<number | null>(null);

    // Memoize the track calculation to avoid re-computing on every render unless segments change.
    const tracks = useMemo(() => {
        const trackList: DiarizationSegment[][] = [];
        if (segments.length > 0) {
            const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
            sortedSegments.forEach(segment => {
                let placed = false;
                for (const track of trackList) {
                    const lastSegmentInTrack = track[track.length - 1];
                    if (segment.start >= lastSegmentInTrack.end) {
                        track.push(segment);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    trackList.push([segment]);
                }
            });
        }
        return trackList;
    }, [segments]);
    
    const timelineHeight = tracks.length * (TRACK_HEIGHT + TRACK_GAP) + TIMESCALE_HEIGHT;
    
    const findSegmentAtPosition = useCallback((mouseX: number, mouseY: number, totalWidth: number): DiarizationSegment | null => {
        if (!totalWidth) return null;
        for (let i = 0; i < tracks.length; i++) {
            const trackY = i * (TRACK_HEIGHT + TRACK_GAP);
            if (mouseY >= trackY && mouseY <= trackY + TRACK_HEIGHT) {
                for (const segment of tracks[i]) {
                    const segX = (segment.start / duration) * totalWidth;
                    const segWidth = ((segment.end - segment.start) / duration) * totalWidth;
                    if (mouseX >= segX && mouseX <= segX + segWidth) {
                        return segment;
                    }
                }
            }
        }
        return null;
    }, [tracks, duration]);

    // The main drawing effect. This runs whenever the data or view parameters change.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !duration || duration <= 0) return;
        
        const totalWidth = canvas.clientWidth;
        if (totalWidth <= 0) return;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = totalWidth * dpr;
        canvas.height = timelineHeight * dpr;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, totalWidth, timelineHeight);

        // --- Draw Timescale and Grid ---
        const interval = getNiceInterval(duration, totalWidth);
        if (interval > 0) {
            ctx.strokeStyle = 'rgba(107, 114, 128, 0.5)'; // gray-500/50
            ctx.fillStyle = '#9CA3AF'; // gray-400
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';

            for (let time = 0; time <= duration; time += interval) {
                const x = (time / duration) * totalWidth;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, timelineHeight - TIMESCALE_HEIGHT);
                ctx.stroke();
                ctx.fillText(formatTimeMarker(time), x, timelineHeight - 5);
            }
        }

        // --- Draw Segments ---
        tracks.forEach((track, trackIndex) => {
            const y = trackIndex * (TRACK_HEIGHT + TRACK_GAP);
            track.forEach(segment => {
                const x = (segment.start / duration) * totalWidth;
                const width = ((segment.end - segment.start) / duration) * totalWidth;
                ctx.fillStyle = speakerMap[segment.speaker]?.color || '#555';
                ctx.fillRect(x, y, Math.max(2, width), TRACK_HEIGHT);
            });
        });
        
        // --- Draw Selected Segment Highlight ---
        if (selectedSegment) {
            const trackIndex = tracks.findIndex(track => track.some(s => s.start === selectedSegment.start && s.end === selectedSegment.end && s.speaker === selectedSegment.speaker));
            if (trackIndex !== -1) {
                const y = trackIndex * (TRACK_HEIGHT + TRACK_GAP);
                const x = (selectedSegment.start / duration) * totalWidth;
                const width = ((selectedSegment.end - selectedSegment.start) / duration) * totalWidth;

                ctx.strokeStyle = '#FFFFFF'; // White border
                ctx.lineWidth = 2;
                ctx.strokeRect(x - 1, y - 1, Math.max(2, width) + 2, TRACK_HEIGHT + 2);
            }
        }

        // --- Draw Playhead ---
        const playheadX = (currentTime / duration) * totalWidth;
        ctx.strokeStyle = '#EF4444'; // red-500
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, timelineHeight - TIMESCALE_HEIGHT);
        ctx.stroke();

    }, [tracks, speakerMap, duration, currentTime, zoomLevel, timelineHeight, selectedSegment]); // Redraw on data/view changes
    
     // Effect for auto-scrolling the timeline to keep the playhead visible.
    useEffect(() => {
        if (!duration || !containerRef.current) return;
        
        const container = containerRef.current;
        const totalWidth = container.scrollWidth;
        if (totalWidth <= container.clientWidth) return; // No need to scroll if it fits

        const playheadPx = (currentTime / duration) * totalWidth;
        const visibleWidth = container.clientWidth;
        const scrollLeft = container.scrollLeft;
        const buffer = visibleWidth * 0.2; // A buffer zone to trigger scrolling

        if (playheadPx < scrollLeft + buffer || playheadPx > scrollLeft + visibleWidth - buffer) {
            const targetScrollLeft = playheadPx - visibleWidth / 2;
            container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
        }
    }, [currentTime, duration, zoomLevel]);


    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Calculate click position
        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const scrollLeft = container.scrollLeft;
        const totalWidth = container.scrollWidth;
        if (totalWidth === 0) return;
        const effectiveX = clickX + scrollLeft;
        const effectiveY = e.clientY - rect.top;

        // On any click, instantly seek. This makes single-clicks responsive.
        const seekTime = Math.max(0, (effectiveX / totalWidth) * duration);
        onSeek(seekTime);

        if (clickTimeoutRef.current) {
            // This is a double-click
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
            
            // Find and select the segment under the cursor
            const segment = findSegmentAtPosition(effectiveX, effectiveY, totalWidth);
            if (segment) {
                onSelectSegment(segment);
            }
        } else {
            // This is a single click (or the first of a double-click)
            
            // A single click should deselect any active segment.
            if (selectedSegment) {
                onSelectSegment(null);
            }

            // Set a timer to detect a double-click
            clickTimeoutRef.current = window.setTimeout(() => {
                clickTimeoutRef.current = null;
            }, 250); // A common double-click threshold
        }
    };


    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const totalWidth = container.scrollWidth;
        
        const effectiveMouseX = e.clientX - rect.left + container.scrollLeft;
        const effectiveMouseY = e.clientY - rect.top;
        
        const foundSegment = findSegmentAtPosition(effectiveMouseX, effectiveMouseY, totalWidth);

        if (foundSegment) {
            setHoveredSegment({ segment: foundSegment, x: e.clientX, y: e.clientY });
        } else {
            setHoveredSegment(null);
        }
    };

    if (segments.length === 0 || !duration || duration <= 0) {
        return <div className="h-24 bg-gray-900 rounded-md flex items-center justify-center text-sm text-gray-500">
            {segments.length === 0 ? 'Speaker timeline will appear here after uploading Pyannote JSON.' : 'Awaiting audio duration...'}
        </div>;
    }

    return (
        <div className="relative">
            <div 
                ref={containerRef}
                className="w-full bg-gray-900 rounded-md py-0 px-0 overflow-x-auto scrollbar-thin cursor-pointer"
                onClick={handleTimelineClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredSegment(null)}
            >
                <canvas 
                    ref={canvasRef} 
                    style={{ 
                        width: `${zoomLevel * 100}%`,
                        height: `${timelineHeight}px`,
                        minWidth: '100%'
                    }}
                />
            </div>
            {hoveredSegment && (
                <div 
                    className="fixed bg-gray-900 text-white text-xs rounded-md shadow-lg p-2 z-50 pointer-events-none transform -translate-y-full -translate-x-1/2"
                    style={{ top: hoveredSegment.y - 10, left: hoveredSegment.x }}
                >
                    <strong style={{ color: speakerMap[hoveredSegment.segment.speaker]?.color || '#fff' }}>
                        {speakerMap[hoveredSegment.segment.speaker]?.name || 'Unknown'}
                    </strong>
                    <div className="font-mono">
                        {hoveredSegment.segment.start.toFixed(2)}s - {hoveredSegment.segment.end.toFixed(2)}s
                    </div>
                </div>
            )}
        </div>
    );
};
