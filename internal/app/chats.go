package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type AgentChat struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	Model     string          `json:"model"`
	Messages  []OllamaMessage `json:"messages"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type AgentChatSummary struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Model     string    `json:"model"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (a *App) ListAgentChats() ([]AgentChatSummary, error) {
	dir, err := agentChatsDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	chats := make([]AgentChatSummary, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		chat, err := readAgentChat(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		chats = append(chats, AgentChatSummary{
			ID:        chat.ID,
			Title:     chat.Title,
			Model:     chat.Model,
			UpdatedAt: chat.UpdatedAt,
		})
	}
	sort.Slice(chats, func(i, j int) bool {
		return chats[i].UpdatedAt.After(chats[j].UpdatedAt)
	})
	return chats, nil
}

func (a *App) LoadAgentChat(id string) (AgentChat, error) {
	if id == "" {
		return AgentChat{}, fmt.Errorf("chat id is required")
	}
	dir, err := agentChatsDir()
	if err != nil {
		return AgentChat{}, err
	}
	return readAgentChat(filepath.Join(dir, safeChatID(id)+".json"))
}

func (a *App) SaveAgentChat(chat AgentChat) (AgentChat, error) {
	dir, err := agentChatsDir()
	if err != nil {
		return AgentChat{}, err
	}
	now := time.Now()
	if chat.ID == "" {
		chat.ID = fmt.Sprintf("chat-%d", now.UnixNano())
	}
	chat.ID = safeChatID(chat.ID)
	if chat.CreatedAt.IsZero() {
		chat.CreatedAt = now
	}
	chat.UpdatedAt = now
	if strings.TrimSpace(chat.Title) == "" {
		chat.Title = chatTitle(chat.Messages)
	}

	body, err := json.MarshalIndent(chat, "", "  ")
	if err != nil {
		return AgentChat{}, err
	}
	if err := os.WriteFile(filepath.Join(dir, chat.ID+".json"), body, 0o600); err != nil {
		return AgentChat{}, err
	}
	return chat, nil
}

func agentChatsDir() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = os.TempDir()
	}
	dir = filepath.Join(dir, "marcus-proxy", "chats")
	return dir, os.MkdirAll(dir, 0o700)
}

func readAgentChat(path string) (AgentChat, error) {
	body, err := os.ReadFile(path)
	if err != nil {
		return AgentChat{}, err
	}
	var chat AgentChat
	if err := json.Unmarshal(body, &chat); err != nil {
		return AgentChat{}, err
	}
	return chat, nil
}

func safeChatID(id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return ""
	}
	var builder strings.Builder
	for _, r := range id {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func chatTitle(messages []OllamaMessage) string {
	for _, message := range messages {
		if message.Role != "user" {
			continue
		}
		title := strings.TrimSpace(message.Content)
		if title == "" {
			continue
		}
		if len(title) > 48 {
			title = title[:48] + "..."
		}
		return title
	}
	return "New chat"
}
