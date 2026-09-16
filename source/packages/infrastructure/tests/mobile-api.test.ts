import { describe, expect, it, vi } from "vitest"
import { createMobileApiClient } from "../src/mobile-api"
import { MobileApiError } from "../src/errors"

describe("createMobileApiClient", () => {
  it("loads consolidated home and appointment initial data through one request each", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: {
              totalLeads: 12,
              newLeads: 3,
              readyToShow: 2,
              appointmentBooked: 1,
              nurture: 4,
              hold: 2,
              averageScore: 7.4
            },
            recentLeads: []
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            appointments: {
              appointments: [],
              total: 0
            },
            eligibleLeads: []
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    await expect(client.getHomeData()).resolves.toMatchObject({
      summary: {
        totalLeads: 12
      },
      recentLeads: []
    })
    await expect(client.getAppointmentsInitialData({ status: "completed" })).resolves.toMatchObject({
      appointments: {
        total: 0
      },
      eligibleLeads: []
    })

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://example.com/api/mobile/home",
      expect.any(Object)
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://example.com/api/mobile/appointments/initial?status=completed&limit=25&offset=0&leadLimit=3",
      expect.any(Object)
    )
  })

  it("caches mobile GET responses briefly and clears them after mutations", async () => {
    let now = 1_000
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            leads: [],
            total: 0
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            lead: {
              id: "lead-1",
              agentId: "agent-1",
              intakeType: "sale",
              buyerName: "Jordan Lane",
              token: "invite-token",
              tokenExpiresAt: "2026-05-11T12:00:00.000Z",
              status: "submitted",
              pipelineStage: "nurture",
              createdAt: "2026-05-04T12:00:00.000Z",
              updatedAt: "2026-05-04T12:00:00.000Z"
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            leads: [],
            total: 0
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            leads: [],
            total: 0
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher,
      cacheTtlMs: 30_000,
      now: () => now
    })

    await expect(client.listLeads({ limit: 4, offset: 0 })).resolves.toEqual({
      leads: [],
      total: 0
    })
    await expect(client.listLeads({ limit: 4, offset: 0 })).resolves.toEqual({
      leads: [],
      total: 0
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    await client.moveLead("lead-1", "nurture")
    await client.listLeads({ limit: 4, offset: 0 })
    expect(fetcher).toHaveBeenCalledTimes(3)

    now += 31_000
    await client.listLeads({ limit: 4, offset: 0 })
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it("clears cached GET responses on demand for workspace refreshes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            leads: [],
            total: 0
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            leads: [],
            total: 0
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher,
      cacheTtlMs: 30_000
    })

    await client.listLeads({ limit: 4, offset: 0 })
    await client.listLeads({ limit: 4, offset: 0 })
    expect(fetcher).toHaveBeenCalledTimes(1)

    client.clearCache()
    await client.listLeads({ limit: 4, offset: 0 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("does not reuse cached GET responses across access tokens", async () => {
    let accessToken = "token-a"
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            leads: [],
            total: 0
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            leads: [],
            total: 0
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => accessToken,
      fetcher,
      cacheTtlMs: 30_000
    })

    await client.listLeads({ limit: 4, offset: 0 })
    await client.listLeads({ limit: 4, offset: 0 })
    expect(fetcher).toHaveBeenCalledTimes(1)

    accessToken = "token-b"
    await client.listLeads({ limit: 4, offset: 0 })
    expect(fetcher).toHaveBeenCalledTimes(2)

    const secondFetchCall = fetcher.mock.calls[1] as unknown as [string, RequestInit] | undefined
    const headers = secondFetchCall?.[1].headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer token-b")
  })

  it("submits authenticated feedback", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: {
          "content-type": "application/json"
        }
      })
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    await expect(client.submitFeedback({ message: "Please add calendar sync." })).resolves.toEqual({
      ok: true
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/feedback",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({ message: "Please add calendar sync." })
      })
    )

    const firstFetchCall = fetcher.mock.calls[0] as unknown as [string, RequestInit] | undefined
    const headers = firstFetchCall?.[1].headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer token-123")
    expect(headers.get("Content-Type")).toBe("application/json")
  })

  it("creates, updates, and deletes leads through authenticated mobile endpoints", async () => {
    const leadPayload = {
      lead: {
        id: "lead-1",
        agentId: "agent-1",
        intakeType: "sale",
        buyerName: "Jordan Lane",
        buyerEmail: "jordan@example.com",
        buyerPhone: "+1 416 555 0101",
        token: "invite-token",
        tokenExpiresAt: "2026-05-11T12:00:00.000Z",
        status: "submitted",
        pipelineStage: "new",
        createdAt: "2026-05-04T12:00:00.000Z",
        updatedAt: "2026-05-04T12:00:00.000Z"
      }
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(leadPayload), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            lead: {
              ...leadPayload.lead,
              buyerName: "Jordan Updated"
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })
    const input = {
      buyerName: "Jordan Lane",
      buyerEmail: "jordan@example.com",
      buyerPhone: "+1 416 555 0101",
      intakeType: "sale" as const
    }

    await expect(client.createLead(input)).resolves.toEqual(leadPayload)
    await expect(
      client.updateLead("lead-1", {
        ...input,
        buyerName: "Jordan Updated"
      })
    ).resolves.toMatchObject({
      lead: {
        buyerName: "Jordan Updated"
      }
    })
    await expect(client.deleteLead("lead-1")).resolves.toEqual({ ok: true })

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://example.com/api/mobile/leads",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input)
      })
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://example.com/api/mobile/leads/lead-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          ...input,
          buyerName: "Jordan Updated"
        })
      })
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://example.com/api/mobile/leads/lead-1",
      expect.objectContaining({
        method: "DELETE"
      })
    )
  })

  it("exports lead CSV data with an authenticated date range request", async () => {
    const fetcher = vi.fn(async () =>
      new Response("First Name,Email\nRiley,riley@example.com\n", {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="showready-leads-2026-05-01-to-2026-05-04.csv"',
          "x-lead-export-count": "1"
        }
      })
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    await expect(
      client.exportLeadsCsv({
        fromDate: "2026-05-01",
        toDate: "2026-05-04",
        timeZone: "America/Toronto"
      })
    ).resolves.toEqual({
      fileName: "showready-leads-2026-05-01-to-2026-05-04.csv",
      csv: "First Name,Email\nRiley,riley@example.com\n",
      rowCount: 1
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/leads/export.csv?from=2026-05-01&to=2026-05-04&timeZone=America%2FToronto",
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    )

    const firstFetchCall = fetcher.mock.calls[0] as unknown as [string, RequestInit] | undefined
    const headers = firstFetchCall?.[1].headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer token-123")
  })

  it("submits authenticated product event batches", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          acceptedCount: 1,
          rejectedCount: 0,
          rejectedEventIds: []
        }),
        {
          status: 202,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    const payload = {
      events: [
        {
          id: "1d0bd5f6-51bd-4d65-a046-608c209f6c92",
          occurredAt: "2026-04-29T12:00:00.000Z",
          eventName: "lead.stage_changed" as const,
          platform: "ios" as const,
          resourceType: "lead",
          resourceId: "lead-1",
          properties: {
            fromStage: "new",
            toStage: "nurture"
          }
        }
      ]
    }

    await expect(client.submitProductEvents(payload)).resolves.toEqual({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/events",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify(payload)
      })
    )
  })

  it("submits authenticated audit event batches", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          acceptedCount: 1,
          rejectedCount: 0,
          rejectedEventIds: []
        }),
        {
          status: 202,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    const payload = {
      events: [
        {
          id: "ab831397-3813-44ca-8495-0e778f8a1aa0",
          occurredAt: "2026-04-29T12:00:00.000Z",
          action: "lead.score_overridden" as const,
          actorType: "agent" as const,
          resourceType: "lead",
          resourceId: "lead-1",
          beforeSummary: {
            scoreBand: "medium"
          },
          afterSummary: {
            scoreBand: "high"
          },
          metadata: {}
        }
      ]
    }

    await expect(client.submitAuditEvents(payload)).resolves.toEqual({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/audit-events",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify(payload)
      })
    )
  })

  it("submits authenticated consent record batches", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          acceptedCount: 1,
          rejectedCount: 0,
          rejectedEventIds: []
        }),
        {
          status: 202,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    const payload = {
      records: [
        {
          id: "61ae65c3-f103-45c6-9a42-a9f5e1785b2f",
          subjectType: "agent" as const,
          consentType: "push_notifications" as const,
          status: "granted" as const,
          source: "mobile-session-provider",
          occurredAt: "2026-04-29T12:00:00.000Z",
          metadata: {
            permissionStatus: "granted"
          }
        }
      ]
    }

    await expect(client.submitConsentRecords(payload)).resolves.toEqual({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/consent-records",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify(payload)
      })
    )
  })

  it("requests account deletion through the authenticated mobile endpoint", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          requestId: "privacy-request-1"
        }),
        {
          status: 202,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    await expect(
      client.requestAccountDeletion({
        note: "Please delete my ShowReady workspace."
      })
    ).resolves.toEqual({
      ok: true,
      requestId: "privacy-request-1"
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/account-deletion",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({
          note: "Please delete my ShowReady workspace."
        })
      })
    )
  })

  it("submits authenticated diagnostics batches", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          acceptedCount: 1,
          rejectedCount: 0,
          rejectedEventIds: []
        }),
        {
          status: 202,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    const payload = {
      events: [
        {
          id: "0c59f42d-ece8-4c07-a4ff-2358a0c1553f",
          sessionId: "session-1",
          deviceId: "device-1",
          occurredAt: "2026-04-21T12:00:00.000Z",
          eventType: "error.handled" as const,
          category: "error" as const,
          severity: "error" as const,
          message: "Unable to restore session.",
          platform: "ios" as const,
          context: {},
          breadcrumbs: [],
          tags: {}
        }
      ]
    }

    await expect(client.submitDiagnostics(payload)).resolves.toEqual({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/diagnostics",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify(payload)
      })
    )

    const firstFetchCall = fetcher.mock.calls[0] as unknown as [string, RequestInit] | undefined
    const headers = firstFetchCall?.[1].headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer token-123")
    expect(headers.get("Content-Type")).toBe("application/json")
  })

  it("reports API request failures through onRequestError before throwing", async () => {
    const onRequestError = vi.fn()
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }))

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher,
      onRequestError
    })

    await expect(client.getDashboardSummary()).rejects.toBeInstanceOf(MobileApiError)
    expect(onRequestError).toHaveBeenCalledWith({
      path: "/api/mobile/dashboard",
      method: "GET",
      status: 500,
      message: "Unable to load dashboard summary."
    })
  })

  it("reports mobile telemetry API failures through onRequestError before throwing", async () => {
    const onRequestError = vi.fn()
    const fetcher = vi.fn(async () => new Response(null, { status: 503 }))

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher,
      onRequestError
    })

    await expect(client.submitProductEvents({} as never)).rejects.toMatchObject({
      status: 503,
      message: "Unable to submit product events."
    })
    await expect(client.submitAuditEvents({} as never)).rejects.toMatchObject({
      status: 503,
      message: "Unable to submit audit events."
    })
    await expect(client.submitConsentRecords({} as never)).rejects.toMatchObject({
      status: 503,
      message: "Unable to submit consent records."
    })
    await expect(client.requestAccountDeletion()).rejects.toMatchObject({
      status: 503,
      message: "Unable to request account deletion."
    })

    expect(onRequestError.mock.calls).toEqual([
      [
        {
          path: "/api/mobile/events",
          method: "POST",
          status: 503,
          message: "Unable to submit product events."
        }
      ],
      [
        {
          path: "/api/mobile/audit-events",
          method: "POST",
          status: 503,
          message: "Unable to submit audit events."
        }
      ],
      [
        {
          path: "/api/mobile/consent-records",
          method: "POST",
          status: 503,
          message: "Unable to submit consent records."
        }
      ],
      [
        {
          path: "/api/mobile/account-deletion",
          method: "POST",
          status: 503,
          message: "Unable to request account deletion."
        }
      ]
    ])
  })

  it("wraps successful response parse failures before they reach mobile screens", async () => {
    const onRequestError = vi.fn()
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          appointments: [
            {
              id: "appointment-1",
              leadId: "lead-1",
              date: "2026-05-04",
              startTime: "12:00:00",
              status: "scheduled",
              createdAt: "2026-05-04T14:00:00.000Z",
              lead: {
                id: "lead-1",
                buyerName: "Taylor Client",
                pipelineStage: "ready_to_show"
              },
              showings: []
            }
          ],
          total: 1
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher,
      onRequestError
    })

    await expect(client.listAppointments("scheduled")).rejects.toMatchObject({
      status: 200,
      message: "Unable to load appointments."
    })
    expect(onRequestError).toHaveBeenCalledWith({
      path: "/api/mobile/appointments?status=scheduled&limit=25&offset=0",
      method: "GET",
      status: 200,
      message: "Unable to load appointments."
    })
  })

  it("wraps network request failures before they reach mobile screens", async () => {
    const onRequestError = vi.fn()
    const fetcher = vi.fn(async () => {
      throw new TypeError("Network request failed")
    })

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher,
      onRequestError
    })

    await expect(
      client.listPipelineLeads({
        tab: "active"
      })
    ).rejects.toMatchObject({
      status: 0,
      message: "Unable to load pipeline leads."
    })
    expect(onRequestError).toHaveBeenCalledWith({
      path: "/api/mobile/pipeline/leads?tab=active&category=all&limit=25&offset=0",
      method: "GET",
      status: 0,
      message: "Unable to load pipeline leads."
    })
  })

  it("records authenticated lead contact interactions", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          interaction: {
            id: "interaction-1",
            leadId: "lead-1",
            agentId: "agent-1",
            method: "text",
            occurredAt: "2026-05-03T15:30:00.000Z"
          }
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    await expect(client.recordLeadContactInteraction("lead-1", "text")).resolves.toEqual({
      interaction: {
        id: "interaction-1",
        leadId: "lead-1",
        agentId: "agent-1",
        method: "text",
        occurredAt: "2026-05-03T15:30:00.000Z"
      }
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/leads/lead-1/contact-interactions",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({ method: "text" })
      })
    )
  })

  it("serializes pipeline lead filters and parses paginated responses", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          leads: [
            {
              id: "lead-1",
              agentId: "agent-1",
              intakeType: "sale",
              buyerName: "Riley Ready",
              buyerEmail: "riley@example.com",
              status: "submitted",
              pipelineStage: "ready_to_show",
              submittedAt: "2026-04-22T12:00:00.000Z",
              score: 8.4,
              recommendation: "show",
              summary: "Ready to tour.",
              createdAt: "2026-04-22T12:00:00.000Z",
              updatedAt: "2026-04-22T12:00:00.000Z",
              lastMovementAt: "2026-04-22T12:00:00.000Z",
              attentionReason: "Ready to show with no appointment scheduled."
            }
          ],
          total: 26,
          nextOffset: 25,
          mode: "filtered_results",
          summaryLabel: "Submitted Apr 22 · 1 shown"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    await expect(
      client.listPipelineLeads({
        tab: "active",
        category: "nurture",
        query: "Riley Ready",
        submittedFrom: "2026-04-22T04:00:00.000Z",
        submittedTo: "2026-04-23T04:00:00.000Z",
        limit: 25,
        offset: 0
      })
    ).resolves.toMatchObject({
      total: 26,
      nextOffset: 25,
      leads: [
        {
          id: "lead-1",
          attentionReason: "Ready to show with no appointment scheduled."
        }
      ]
    })

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/mobile/pipeline/leads?tab=active&category=nurture&query=Riley+Ready&submittedFrom=2026-04-22T04%3A00%3A00.000Z&submittedTo=2026-04-23T04%3A00%3A00.000Z&limit=25&offset=0",
      expect.any(Object)
    )
  })

  it("serializes paginated mobile lead and appointment list requests", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            leads: [],
            total: 124,
            nextOffset: 10
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            appointments: [],
            total: 9,
            nextOffset: 25
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )

    const client = createMobileApiClient({
      supabase: {} as never,
      apiBaseUrl: "https://example.com",
      getAccessToken: async () => "token-123",
      fetcher
    })

    await expect(
      client.listLeads({
        scope: "appointment_eligible",
        query: "Riley",
        limit: 10,
        offset: 0
      })
    ).resolves.toEqual({
      leads: [],
      total: 124,
      nextOffset: 10
    })
    await expect(client.listAppointments({ status: "scheduled", limit: 25, offset: 0 })).resolves.toEqual({
      appointments: [],
      total: 9,
      nextOffset: 25
    })

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://example.com/api/mobile/leads?scope=appointment_eligible&query=Riley&limit=10&offset=0",
      expect.any(Object)
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://example.com/api/mobile/appointments?status=scheduled&limit=25&offset=0",
      expect.any(Object)
    )
  })
})
