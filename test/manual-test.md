# Manual Test Plan for Maestro-MCP

Bu dosya, MCP Server'ın manuel test edilmesi için adım adım talimatlar içerir.

## Test Ortamı Hazırlama

### 1. MCP Inspector Kurulumu

```bash
npm install -g @modelcontextprotocol/inspector
```

### 2. Server'ı Başlatma

```bash
cd server
npm start
```

## Test Senaryoları

### Senaryo 1: Client Kayıt

1. MCP Inspector'ı açın:
```bash
npx @modelcontextprotocol/inspector server/dist/index.js
```

2. Web arayüzünde (http://localhost:5173) Tools sekmesine gidin

3. `register_client` tool'unu çağırın:
```json
{
  "clientName": "TestPlanner1",
  "role": "planner"
}
```

Beklenen Sonuç: Client ID döner ve başarı mesajı görünür.

4. Başka bir executor client kaydedin:
```json
{
  "clientName": "TestExecutor1",
  "role": "executor"
}
```

5. `list_clients` tool'unu çağırarak kayıtlı client'ları görün.

### Senaryo 2: Görev Oluşturma ve Atama

1. `create_task` tool'unu çağırın:
```json
{
  "description": "Create a simple web application",
  "requirements": ["Use React", "Add authentication", "Deploy to cloud"]
}
```

Task ID'yi not edin.

2. `assign_task` tool'unu çağırın:
```json
{
  "taskId": "<task-id>",
  "plannerId": "<planner-client-id>"
}
```

3. `get_task_status` ile durumu kontrol edin:
```json
{
  "taskId": "<task-id>"
}
```

### Senaryo 3: Plan Oluşturma ve Dağıtım

1. `create_plan` tool'unu çağırın:
```json
{
  "taskId": "<task-id>",
  "plannerId": "<planner-id>",
  "steps": [
    {"description": "Setup React project", "dependencies": []},
    {"description": "Implement authentication", "dependencies": []},
    {"description": "Deploy application", "dependencies": ["0", "1"]}
  ]
}
```

Plan ID ve step ID'leri not edin.

2. `distribute_plan` tool'unu çağırın:
```json
{
  "planId": "<plan-id>",
  "assignments": {
    "<executor-id>": ["<step-id-1>", "<step-id-2>"]
  }
}
```

### Senaryo 4: Rapor Gönderme

1. `submit_report` tool'unu çağırın:
```json
{
  "planId": "<plan-id>",
  "stepId": "<step-id>",
  "executorId": "<executor-id>",
  "status": "success",
  "results": {
    "message": "Step completed successfully",
    "output": "Created 5 files"
  }
}
```

2. `get_executor_reports` ile raporları kontrol edin:
```json
{
  "planId": "<plan-id>"
}
```

### Senaryo 5: Resource Okuma

1. Resources sekmesine gidin

2. `maestro://system/state` resource'unu okuyun

3. `maestro://tasks/active` resource'unu okuyun

4. `maestro://plans/active` resource'unu okuyun

## Beklenen Sonuçlar

✅ Tüm tool'lar başarıyla çalışmalı
✅ Client'lar kaydedilmeli ve listelenebilmeli
✅ Görevler oluşturulup atanabilmeli
✅ Planlar oluşturulup dağıtılabilmeli
✅ Raporlar gönderilebilmeli
✅ Resource'lar okunabilmeli
✅ shared/ klasöründe JSON dosyaları oluşmalı

## File System Kontrolü

Test sırasında şu klasörlerde dosyalar oluşmalı:

- `shared/tasks/` - Görev JSON dosyaları
- `shared/plans/` - Plan JSON dosyaları
- `shared/reports/` - Rapor JSON dosyaları
- `shared/state/` - Sistem durumu (system.json)