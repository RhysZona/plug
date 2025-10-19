import React, { useRef, useEffect, useState } from 'react';
import type { DiarizationSegment, SpeakerMap } from '../../types';

// --- COMPONENT CONSTANTS ---
const TRACK_HEIGHT = 12; // Height of each individual speaker track in pixels.
const TRACK_GAP = 2; // Vertical gap between speaker tracks in pixels.
const TIMESCALE_HEIGHT = 20; // Reserved vertical space at the bottom for rendering time labels.

// --- PROPS INTERFACE ---
interface SpeakerTimelineProps {
    segments: DiarizationSegment[];
    speakerMap: SpeakerMap;
    duration: number;
    currentTime: number;
    onSeek: (time: number) => void;
    zoomLevel: number;
}

/**
 * Calculates a "nice" time interval for the timeline grid markers.
 * The goal is to avoid cluttering the timescale with too many labels, especially when zoomed in.
 * It determines an interval (e.g., 1s, 5s, 10s, 60s) that ensures a minimum pixel gap between markers.
 * @param duration - The total duration of the audio in seconds.
 * @param zoomLevel - The current zoom multiplier (1 = 100%).
 * @param containerWidth - The visible width of the timeline container in pixels.
 * @returns A suitable time interval in seconds.
 */
const getNiceInterval = (duration: number, zoomLevel: number, containerWidth: number): number => {
    // Safety checks for invalid inputs to prevent division by zero or infinite loops.
    if (!containerWidth || !duration || duration <= 0 || zoomLevel <= 0) return 60;
    
    const minMarkerGapPx = 90; // The desired minimum space between any two time markers.
    const totalWidth = containerWidth * zoomLevel; // The total virtual width of the timeline after zooming.
    const timePerPixel = duration / totalWidth; // How many seconds are represented by a single pixel.
    const minTimeInterval = timePerPixel * minMarkerGapPx; // The minimum time interval needed to satisfy the pixel gap.

    // A predefined list of "human-friendly" time intervals in seconds.
    const niceIntervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
    
    // Find the smallest "nice" interval that is larger than our calculated minimum.
    return niceIntervals.find(interval => interval >= minTimeInterval) || niceIntervals[niceIntervals.length - 1];
};

/**
 * Formats a time in seconds into a MM:SS string for display on the timescale.
 * @param timeInSeconds - The time to format.
 * @returns A formatted string (e.g., "01:35").
 */
const formatTimeMarker = (timeInSeconds: number): string => {
    const date = new Date(timeInSeconds * 1000);
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${minutes}:${seconds}`;
};


/**
 * A component that visualizes speaker diarization segments on a timeline.
 * This implementation uses HTML divs for rendering. It's easy to inspect and style,
 * but may face performance challenges with extremely long audio files (thousands of segments).
 */
export const HtmlTimeline: React.FC<SpeakerTimelineProps> = ({ segments, speakerMap, duration, currentTime, onSeek, zoomLevel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // This effect uses a ResizeObserver to monitor the width of the timeline's container div.
    // This is crucial for correctly calculating the positions of markers and segments,
    // ensuring the timeline is responsive to window size changes.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(container);
        setContainerWidth(container.clientWidth); // Set initial width on mount.

        return () => resizeObserver.disconnect(); // Clean up the observer on unmount.
    }, []);

    // This effect handles auto-scrolling the timeline to keep the playhead visible.
    // When the playhead gets close to the edge of the visible area, it smoothly scrolls
    // the container to center the playhead.
    useEffect(() => {
        if (!duration || !containerRef.current) return;
        
        const container = containerRef.current;
        const totalWidth = container.scrollWidth;
        const playheadPx = (currentTime / duration) * totalWidth;

        const visibleWidth = container.clientWidth;
        const scrollLeft = container.scrollLeft;

        // A buffer zone (10% of the visible width) near the edges to trigger scrolling.
        const buffer = visibleWidth * 0.1;

        // Check if the playhead is outside the central 80% of the view.
        if (playheadPx < scrollLeft + buffer || playheadPx > scrollLeft + visibleWidth - buffer) {
            // Calculate the target scroll position to center the playhead.
            const targetScrollLeft = playheadPx - visibleWidth / 2;
            container.scrollTo({
                left: targetScrollLeft,
                behavior: 'smooth'
            });
        }
    }, [currentTime, duration, zoomLevel]);

    // Render a placeholder if there's no data to display.
    if (segments.length === 0 || !duration || duration <= 0) {
        return <div className="h-24 bg-gray-900 rounded-md flex items-center justify-center text-sm text-gray-500">
            {segments.length === 0 ? 'Speaker timeline will appear here after uploading Pyannote JSON.' : 'Awaiting audio duration...'}
        </div>;
    }

    // --- Track Calculation Logic ---
    // This logic arranges speaker segments into the minimum number of horizontal tracks needed
    // to display them without any overlaps. It's a simple form of layout packing.
    const tracks: DiarizationSegment[][] = [];
    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    sortedSegments.forEach(segment => {
        let placed = false;
        // Iterate through existing tracks to find a spot for the current segment.
        for (const track of tracks) {
            const lastSegmentInTrack = track[track.length - 1];
            if (segment.start >= lastSegmentInTrack.end) {
                // Found a free spot in this track.
                track.push(segment);
                placed = true;
                break;
            }
        }
        // If no spot was found in existing tracks, create a new one.
        if (!placed) {
            tracks.push([segment]);
        }
    });
    
    const timelineHeight = tracks.length * (TRACK_HEIGHT + TRACK_GAP) + TIMESCALE_HEIGHT;
    
    // --- Time Marker Generation ---
    // Generates an array of time points (in seconds) where grid lines and labels should be drawn.
    const timeMarkers: number[] = [];
    const interval = getNiceInterval(duration, zoomLevel, containerWidth);
    if (duration > 0 && interval > 0) {
        for (let i = 0; i <= duration; i += interval) {
            timeMarkers.push(i);
        }
    }

    /**
     * Handles clicks on the timeline to seek the audio playback.
     * It calculates the clicked time based on the mouse position relative to the timeline's total virtual width.
     */
    const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left; // Click position relative to the visible part of the container.
        const scrollLeft = container.scrollLeft; // How much the container is scrolled.
        const totalWidth = container.scrollWidth; // The total virtual width, including the scrolled-out part.
        
        if (totalWidth === 0) return;
        
        const effectiveX = clickX + scrollLeft; // The absolute click position on the virtual timeline.
        
        // Calculate the seek time and ensure it's within bounds [0, duration].
        const seekTime = Math.max(0, (effectiveX / totalWidth) * duration);
        onSeek(seekTime);
    };

    return (
        <div 
            ref={containerRef}
            className="w-full bg-gray-900 rounded-md py-2.5 px-0 overflow-x-auto scrollbar-thin"
            onClick={handleSeekClick}
        >
            <div 
                className="relative cursor-pointer"
                style={{ width: `${zoomLevel * 100}%`, height: `${timelineHeight}px`, minWidth: '100%' }}
            >
                {/* Render Time Markers & Grid Lines */}
                {timeMarkers.map(time => (
                    <div key={`marker-${time}`} className="absolute top-0 h-full pointer-events-none" style={{ left: `${(time / duration) * 100}%`}}>
                        <div className="w-px bg-gray-700/50" style={{height: `${timelineHeight - TIMESCALE_HEIGHT}px`}}></div>
                        <span className="absolute text-xs text-gray-500 transform -translate-x-1/2" style={{ top: `${timelineHeight - TIMESCALE_HEIGHT + 5}px` }}>
                            {formatTimeMarker(time)}
                        </span>
                    </div>
                ))}
                
                {/* Render Speaker Segments on their respective tracks */}
                {tracks.map((track, trackIndex) => (
                    <div key={trackIndex} className="absolute w-full pointer-events-none" style={{ top: `${trackIndex * (TRACK_HEIGHT + TRACK_GAP)}px`, height: `${TRACK_HEIGHT}px` }}>
                        {track.map((segment, segIndex) => (
                            <div
                                key={segIndex}
                                className="absolute h-full rounded flex items-center justify-start px-2 overflow-hidden"
                                style={{
                                    left: `${(segment.start / duration) * 100}%`,
                                    width: `${((segment.end - segment.start) / duration) * 100}%`,
                                    minWidth: '2px', // Ensure very short segments are still visible.
                                    backgroundColor: speakerMap[segment.speaker]?.color || '#555',
                                }}
                                title={`${speakerMap[segment.speaker]?.name}: ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s`}
                            >
                            </div>
                        ))}
                    </div>
                ))}

                {/* Render the Playhead */}
                <div
                    className="absolute top-0 w-0.5 bg-red-500 pointer-events-none"
                    style={{
                        left: `${(currentTime / duration) * 100}%`,
                        height: `${timelineHeight - TIMESCALE_HEIGHT}px`,
                    }}
                >
                    <div className="absolute -top-1 -ml-1 w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
            </div>
        </div>
    );
};