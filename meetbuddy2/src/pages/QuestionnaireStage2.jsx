// src/pages/QuestionnaireStage2.jsx
// Stage 2 merged into the single questionnaire flow (QuestionnaireStage1).
// This route stays as a redirect so old links keep working.
import { Navigate } from "react-router-dom";

export default function QuestionnaireStage2() {
  return <Navigate to="/questionnaire-stage1" replace />;
}
