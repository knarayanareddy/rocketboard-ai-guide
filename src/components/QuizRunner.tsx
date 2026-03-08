import { useState } from "react";
import { QuizQuestion } from "@/data/onboarding-data";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Trophy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizRunnerProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
}

export function QuizRunner({ questions, onComplete }: QuizRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = questions[currentIndex];

  const handleSelect = (optionIndex: number) => {
    if (showResult) return;
    setSelectedOption(optionIndex);
    setShowResult(true);
    if (optionIndex === current.correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setFinished(true);
      onComplete(score + (selectedOption === current.correctIndex ? 0 : 0));
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const finalScore = score;
    const percentage = Math.round((finalScore / questions.length) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <div className="w-20 h-20 rounded-full gradient-primary mx-auto flex items-center justify-center mb-6">
          <Trophy className="w-10 h-10 text-primary-foreground" />
        </div>
        <h3 className="text-2xl font-bold text-card-foreground mb-2">Quiz Complete!</h3>
        <p className="text-4xl font-bold gradient-text mb-2">{percentage}%</p>
        <p className="text-muted-foreground mb-6">
          You got {finalScore} out of {questions.length} correct
        </p>
        <Button onClick={handleRetry} variant="outline" className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Retry Quiz
        </Button>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-mono text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < currentIndex
                  ? "bg-primary"
                  : i === currentIndex
                  ? "bg-primary animate-pulse-glow"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <h3 className="text-lg font-semibold text-card-foreground mb-6">
            {current.question}
          </h3>

          <div className="space-y-3">
            {current.options.map((option, i) => {
              let optionClass =
                "border border-border bg-card hover:border-primary/40 text-card-foreground";
              if (showResult) {
                if (i === current.correctIndex) {
                  optionClass = "border-primary bg-primary/10 text-primary";
                } else if (i === selectedOption && i !== current.correctIndex) {
                  optionClass = "border-destructive bg-destructive/10 text-destructive";
                } else {
                  optionClass = "border-border bg-muted/30 text-muted-foreground opacity-50";
                }
              }
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={showResult}
                  className={`w-full text-left p-4 rounded-lg transition-all flex items-center gap-3 ${optionClass}`}
                >
                  <span className="w-7 h-7 rounded-full border border-current flex items-center justify-center text-xs font-mono shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm">{option}</span>
                  {showResult && i === current.correctIndex && (
                    <CheckCircle2 className="w-4 h-4 ml-auto shrink-0" />
                  )}
                  {showResult && i === selectedOption && i !== current.correctIndex && (
                    <XCircle className="w-4 h-4 ml-auto shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 rounded-lg bg-muted/50 border border-border"
            >
              <p className="text-sm text-muted-foreground">{current.explanation}</p>
            </motion.div>
          )}

          {showResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 flex justify-end"
            >
              <Button onClick={handleNext} className="gap-2 gradient-primary text-primary-foreground border-0">
                {currentIndex < questions.length - 1 ? "Next Question" : "See Results"}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
