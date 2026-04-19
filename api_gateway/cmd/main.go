package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/school-crm/api-gateway/internal/config"
	"github.com/school-crm/api-gateway/internal/logger"
	"github.com/school-crm/api-gateway/internal/router"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()
	logger.Init(cfg.Environment)

	if errs := cfg.Validate(); len(errs) > 0 {
		for _, e := range errs {
			slog.Error("config error", "error", e)
		}
		slog.Error("startup aborted — fix configuration errors above")
		os.Exit(1)
	}

	r, err := router.New(cfg)
	if err != nil {
		slog.Error("build router", "error", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		slog.Info("HTTP listening",
			"port", cfg.Port,
			"service", "api_gateway",
			"monolith", cfg.MonolithURL,
			"auth", cfg.AuthServiceURL,
		)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("listen failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down", "service", "api_gateway")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
	}
	slog.Info("stopped", "service", "api_gateway")
}
