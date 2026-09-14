import React, { Suspense, lazy } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

const EventsPage = lazy(() => import("../EventsPage"));

export const StudentSeminaryTab: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Suspense
        fallback={
          <div className="flex justify-center items-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          </div>
        }
      >
        <EventsPage renderSeminary={true} />
      </Suspense>
    </motion.div>
  );
};

export default StudentSeminaryTab;
