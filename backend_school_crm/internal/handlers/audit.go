package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/db"
)

// AuditLogEntry is the response shape for a single audit record.
type AuditLogEntry struct {
	ID          string    `json:"id"`
	BranchID    *string   `json:"branchId"`
	UserID      *string   `json:"userId"`
	UserName    string    `json:"userName"`
	Action      string    `json:"action"`
	Resource    string    `json:"resource"`
	ResourceID  *string   `json:"resourceId"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

// RegisterAuditRoutes mounts the audit log read endpoint.
//
//	GET /audit-logs  — paginated audit log for the current branch
func RegisterAuditRoutes(router *gin.RouterGroup, database *db.Database) {
	router.GET("/audit-logs", listAuditLogs(database))
}

func listAuditLogs(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "X-Branch-ID header required"})
			return
		}

		// Filters
		resource := c.Query("resource") // e.g. "payment"
		userID := c.Query("userId")
		from := c.Query("from") // ISO date string
		to := c.Query("to")

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 25
		}
		offset := (page - 1) * limit

		// Build query dynamically
		where := " WHERE al.branch_id = $1 "
		args := []interface{}{branchID}
		idx := 2

		if resource != "" {
			where += " AND al.resource = $" + strconv.Itoa(idx)
			args = append(args, resource)
			idx++
		}
		if userID != "" {
			where += " AND al.user_id = $" + strconv.Itoa(idx)
			args = append(args, userID)
			idx++
		}
		if from != "" {
			where += " AND al.created_at >= $" + strconv.Itoa(idx)
			args = append(args, from)
			idx++
		}
		if to != "" {
			where += " AND al.created_at <= $" + strconv.Itoa(idx)
			args = append(args, to+"T23:59:59Z")
			idx++
		}

		// Total count
		var total int
		countSQL := "SELECT COUNT(*) FROM audit_logs al" + where
		if err := database.GetConn().QueryRowContext(c.Request.Context(), countSQL, args...).Scan(&total); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Paginated rows with LEFT JOIN to get user name
		dataSQL := `
			SELECT al.id,
			       al.branch_id::text,
			       al.user_id::text,
			       COALESCE(u.full_name, ''),
			       al.action,
			       al.resource,
			       al.resource_id::text,
			       al.description,
			       al.created_at
			FROM audit_logs al
			LEFT JOIN users u ON u.id = al.user_id
		` + where + `
			ORDER BY al.created_at DESC
			LIMIT $` + strconv.Itoa(idx) + ` OFFSET $` + strconv.Itoa(idx+1)

		args = append(args, limit, offset)

		rows, err := database.GetConn().QueryContext(c.Request.Context(), dataSQL, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		entries := []AuditLogEntry{}
		for rows.Next() {
			var e AuditLogEntry
			var bid, uid, rid *string
			if err := rows.Scan(
				&e.ID, &bid, &uid, &e.UserName,
				&e.Action, &e.Resource, &rid,
				&e.Description, &e.CreatedAt,
			); err != nil {
				continue
			}
			e.BranchID = bid
			e.UserID = uid
			e.ResourceID = rid
			entries = append(entries, e)
		}

		c.JSON(http.StatusOK, gin.H{
			"data":       entries,
			"total":      total,
			"page":       page,
			"limit":      limit,
			"totalPages": (total + limit - 1) / limit,
		})
	}
}
