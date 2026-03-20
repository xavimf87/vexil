package vexil

import (
	"fmt"
	"os"
	"strings"
)

// envProvider reads flags from environment variables.
// Flag name "dark-mode" maps to env var "FLAG_DARK_MODE".
type envProvider struct{}

func flagNameToEnvVar(name string) string {
	return "FLAG_" + strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
}

func (p *envProvider) GetFlag(name string) (Flag, error) {
	envName := flagNameToEnvVar(name)
	val, ok := os.LookupEnv(envName)
	if !ok {
		return Flag{}, fmt.Errorf("flag %s not found (env var %s)", name, envName)
	}
	return Flag{
		Name:  name,
		Type:  "string",
		Value: val,
	}, nil
}

func (p *envProvider) GetAllFlags() ([]Flag, error) {
	var flags []Flag
	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key, val := parts[0], parts[1]
		if !strings.HasPrefix(key, "FLAG_") {
			continue
		}
		name := strings.ToLower(strings.ReplaceAll(strings.TrimPrefix(key, "FLAG_"), "_", "-"))
		flags = append(flags, Flag{
			Name:  name,
			Type:  "string",
			Value: val,
		})
	}
	return flags, nil
}

func (p *envProvider) Close() error { return nil }
