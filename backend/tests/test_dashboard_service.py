from app.services import dashboard_service


def test_efficiency_items_use_bounded_percent_scale(monkeypatch):
    monkeypatch.setattr(
        dashboard_service,
        "_monthly_aggregates",
        lambda _db: [
            {
                "year": 2026,
                "month": 6,
                "electricity_kwh": 100.0,
                "water_m3": 50.0,
                "total_cost_usd": 0.0,
                "co2_avoided_ton": 75.0,
            }
        ],
    )
    monkeypatch.setattr(
        dashboard_service,
        "_target_map",
        lambda _db: {
            "electricity_kwh": 200.0,
            "water_m3": 75.0,
            "co2_avoided_ton": 50.0,
        },
    )

    response = dashboard_service.get_efficiency(None)

    assert response.score == 100.0
    assert [item.target for item in response.items] == [100.0, 100.0, 100.0, 100.0]
    assert all(0.0 <= item.value <= 100.0 for item in response.items)
