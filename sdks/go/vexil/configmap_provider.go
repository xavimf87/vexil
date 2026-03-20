package vexil

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// configMapProvider reads flags from a mounted ConfigMap.
// If path is a directory, each file is a flag (filename=name, content=value).
// If path is a file, it's parsed as JSON {"name": "value", ...}.
type configMapProvider struct {
	path string
}

func (p *configMapProvider) GetFlag(name string) (Flag, error) {
	info, err := os.Stat(p.path)
	if err != nil {
		return Flag{}, fmt.Errorf("config path error: %w", err)
	}

	if info.IsDir() {
		data, err := os.ReadFile(filepath.Join(p.path, name))
		if err != nil {
			return Flag{}, fmt.Errorf("flag %s not found: %w", name, err)
		}
		return Flag{
			Name:  name,
			Type:  "string",
			Value: strings.TrimSpace(string(data)),
		}, nil
	}

	// JSON file mode
	flags, err := p.readJSONFile()
	if err != nil {
		return Flag{}, err
	}
	val, ok := flags[name]
	if !ok {
		return Flag{}, fmt.Errorf("flag %s not found in %s", name, p.path)
	}
	return Flag{
		Name:  name,
		Type:  "string",
		Value: val,
	}, nil
}

func (p *configMapProvider) GetAllFlags() ([]Flag, error) {
	info, err := os.Stat(p.path)
	if err != nil {
		return nil, fmt.Errorf("config path error: %w", err)
	}

	if info.IsDir() {
		entries, err := os.ReadDir(p.path)
		if err != nil {
			return nil, err
		}
		var flags []Flag
		for _, e := range entries {
			if e.IsDir() || strings.HasPrefix(e.Name(), ".") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(p.path, e.Name()))
			if err != nil {
				continue
			}
			flags = append(flags, Flag{
				Name:  e.Name(),
				Type:  "string",
				Value: strings.TrimSpace(string(data)),
			})
		}
		return flags, nil
	}

	flagMap, err := p.readJSONFile()
	if err != nil {
		return nil, err
	}
	var flags []Flag
	for name, val := range flagMap {
		flags = append(flags, Flag{
			Name:  name,
			Type:  "string",
			Value: val,
		})
	}
	return flags, nil
}

func (p *configMapProvider) readJSONFile() (map[string]string, error) {
	data, err := os.ReadFile(p.path)
	if err != nil {
		return nil, err
	}
	var flags map[string]string
	if err := json.Unmarshal(data, &flags); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", p.path, err)
	}
	return flags, nil
}

func (p *configMapProvider) Close() error { return nil }
