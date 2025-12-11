package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func ErrorHandling() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				switch err.Type {
				case gin.ErrorTypeBind:
					c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				case gin.ErrorTypePublic:
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				}
			}
		}
	}
}
