import { useContext } from 'react';
import { FeedbackContext } from '../context/FeedbackContext';

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error('useFeedback deve ser usado dentro de FeedbackProvider.');
  }

  return context;
}
