import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TILE_COLORS } from '../constants';

const CELL_SIZE = 64;
const GAP = 12;

export const LoadingScreen: React.FC = () => {
    // Animation phases: 0=Separate, 1=Merging, 2=Merged/Pulse
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const runAnimation = async () => {
            // Phase 0: Start separate
            setPhase(0);
            await new Promise(r => setTimeout(r, 50));

            // Phase 1: Move together
            setPhase(1);
            await new Promise(r => setTimeout(r, 400)); // Slide duration

            // Phase 2: Show merged block (Hold until unmount)
            setPhase(2);
        };
        runAnimation();
    }, []);

    return (
        <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-2xl"
        >
            <div className="relative flex flex-col items-center">
                {/* Abstract Game Architecture: The Merge */}
                <div className="relative h-24 w-48 flex items-center justify-center mb-8">
                    <AnimatePresence mode="popLayout">
                        {phase < 2 ? (
                            <>
                                {/* Left Block (4) */}
                                <motion.div
                                    key="block-left"
                                    initial={{ x: -40, opacity: 0, scale: 0.8 }}
                                    animate={{
                                        x: phase === 0 ? -40 : 0,
                                        opacity: 1,
                                        scale: 1
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 200,
                                        damping: 25
                                    }}
                                    className={`absolute w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${TILE_COLORS[4]}`}
                                >
                                    4
                                </motion.div>

                                {/* Right Block (4) */}
                                <motion.div
                                    key="block-right"
                                    initial={{ x: 40, opacity: 0, scale: 0.8 }}
                                    animate={{
                                        x: phase === 0 ? 40 : 0,
                                        opacity: 1,
                                        scale: 1
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 200,
                                        damping: 25
                                    }}
                                    className={`absolute w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${TILE_COLORS[4]}`}
                                >
                                    4
                                </motion.div>
                            </>
                        ) : (
                            /* Merged Block (8) */
                            <motion.div
                                key="block-merged"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: 1,
                                    rotate: [0, -5, 5, 0]
                                }}
                                transition={{
                                    duration: 0.5,
                                    ease: "backOut"
                                }}
                                className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold z-10 ${TILE_COLORS[8]}`}
                                style={{
                                    boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)" // Blue glow matching liquid theme
                                }}
                            >
                                8
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Title */}
                <motion.h1
                    className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 mb-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    SlideMino
                </motion.h1>

                {/* Subtitle / Loading Text with Pulse */}
                <motion.div
                    className="text-slate-400 font-medium text-sm tracking-widest uppercase"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                >
                    Loading
                </motion.div>
            </div>

            {/* Footer Branding */}
            <div className="absolute bottom-12 text-slate-300 text-xs">
                Original Puzzle Logic
            </div>
        </motion.div>
    );
};
