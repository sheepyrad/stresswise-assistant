
import { useState, useEffect, useCallback } from 'react';
import { callChatApi } from '@/lib/apiClient';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

export interface ChatOptions {
  initialMessages?: Message[];
  systemPrompt?: string;
  apiFunction?: (message: string, systemPrompt: string) => Promise<string>;
}

const defaultSystemPrompt = `
You are MentalHealthChat, an AI assistant focused on supporting mental wellbeing. 
Your responses should be empathetic, supportive, and helpful. 
Provide guidance on stress management, emotional wellbeing, and mindfulness.
Suggest practical exercises when appropriate.
If the user seems to be in crisis, gently suggest professional help.
`;

export const useChat = (options: ChatOptions = {}) => {
  const [messages, setMessages] = useState<Message[]>(
    options.initialMessages || [
      {
        id: '1',
        text: "Hi there! I'm MentalHealthChat, your supportive companion. How are you feeling today?",
        isUser: false,
        timestamp: new Date().toISOString()
      }
    ]
  );
  
  const [isLoading, setIsLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(options.systemPrompt || defaultSystemPrompt);
  
  // Initialize apiFunction with a default function to prevent "not a function" errors
  const [apiFunction, setApiFunction] = useState<(message: string, systemPrompt: string) => Promise<string>>(
    () => options.apiFunction || callChatApi
  );

  // Update API function if provided in options
  useEffect(() => {
    if (options.apiFunction) {
      setApiFunction(() => options.apiFunction);
    } else {
      setApiFunction(() => callChatApi);
    }
  }, [options.apiFunction]);

  // Update system prompt if provided in options
  useEffect(() => {
    if (options.systemPrompt) {
      setSystemPrompt(options.systemPrompt);
    }
  }, [options.systemPrompt]);

  const addMessage = useCallback((text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const callApiWithRetry = useCallback(async (
    userMessage: string, 
    retryCount = 0, 
    maxRetries = 3
  ): Promise<string> => {
    try {
      // Ensure apiFunction is callable before invoking
      if (typeof apiFunction !== 'function') {
        console.error('API function is not properly initialized:', apiFunction);
        return "I'm having trouble connecting to my brain right now. Please try again in a moment.";
      }
      
      return await apiFunction(userMessage, systemPrompt);
    } catch (error) {
      console.error("API call error:", error);
      if (retryCount < maxRetries) {
        console.log(`Retrying API call (${retryCount + 1}/${maxRetries})...`);
        // Exponential backoff: 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return callApiWithRetry(userMessage, retryCount + 1, maxRetries);
      }
      throw error;
    }
  }, [apiFunction, systemPrompt]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    const userMessage = addMessage(text, true);
    setIsLoading(true);
    
    try {
      const response = await callApiWithRetry(text);
      addMessage(response, false);
    } catch (error) {
      console.error("Failed to get response:", error);
      addMessage("I'm having trouble responding right now. Please try again in a moment.", false);
    } finally {
      setIsLoading(false);
    }
    
    return userMessage;
  }, [addMessage, callApiWithRetry]);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: '1',
        text: "Hi there! I'm MentalHealthChat, your supportive companion. How are you feeling today?",
        isUser: false,
        timestamp: new Date().toISOString()
      }
    ]);
  }, []);

  // Function to update the API
  const updateApiFunction = useCallback((newApiFunction: (message: string, systemPrompt: string) => Promise<string>) => {
    if (typeof newApiFunction === 'function') {
      setApiFunction(() => newApiFunction);
    } else {
      console.error('Attempted to update apiFunction with a non-function value:', newApiFunction);
    }
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    isLoading,
    updateApiFunction,
    setSystemPrompt
  };
};
