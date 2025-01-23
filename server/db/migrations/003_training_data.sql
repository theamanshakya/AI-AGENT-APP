-- Create training_data table
CREATE TABLE training_data (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES ai_agents(id),
    user_message JSONB NOT NULL,
    ai_message JSONB NOT NULL,
    domain VARCHAR(255),
    learning_mode VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster queries
CREATE INDEX idx_training_data_agent_id ON training_data(agent_id); 