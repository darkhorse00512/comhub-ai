import { motion } from "framer-motion";

const HomePage = () => {
  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Welcome to ComHub AI
        </h1>
        <p className="text-muted-foreground">
          Select a section from the sidebar to get started
        </p>
      </motion.div>
    </div>
  );
};

export default HomePage;
