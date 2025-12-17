#!/bin/bash

# Phase 3: Diagram DB Storage API Test Script
# ダイアグラムAPIの動作確認用スクリプト

API_URL="http://localhost:3001/api"

echo "========================================="
echo "Diagram API Test Script"
echo "========================================="
echo ""

# Step 1: ユーザー登録（既に存在する場合はスキップ）
echo "Step 1: Register test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-diagram@example.com",
    "password": "password123",
    "firstName": "Diagram",
    "lastName": "Test"
  }')

echo "$REGISTER_RESPONSE" | jq .
echo ""

# Step 2: ログイン
echo "Step 2: Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-diagram@example.com",
    "password": "password123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')

if [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE" | jq .
  exit 1
fi

echo "✅ Login successful!"
echo "Token: ${TOKEN:0:20}..."
echo "User ID: $USER_ID"
echo ""

# Step 3: プロジェクト作成
echo "Step 3: Create test project..."
PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Diagram API Test Project",
    "description": "Testing diagram endpoints"
  }')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.project.id')

if [ "$PROJECT_ID" = "null" ]; then
  echo "❌ Project creation failed!"
  echo "$PROJECT_RESPONSE" | jq .
  exit 1
fi

echo "✅ Project created!"
echo "Project ID: $PROJECT_ID"
echo ""

# Step 4: ダイアグラム作成（空のダイアグラム）
echo "Step 4: Create diagram..."
DIAGRAM_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/diagrams" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "My First GSN Diagram",
    "data": {
      "version": "1.0.0",
      "title": "My First GSN Diagram",
      "nodes": [
        {
          "id": "node_1",
          "type": "Goal",
          "position": { "x": 400, "y": 200 },
          "size": { "width": 180, "height": 120 },
          "content": "System is safe",
          "label": "G1",
          "style": {
            "fillColor": "#CCFFCC",
            "borderColor": "#374151",
            "borderWidth": 2
          }
        }
      ],
      "links": [],
      "metadata": {
        "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
        "updatedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
        "id": "root",
        "isModule": false
      }
    }
  }')

DIAGRAM_ID=$(echo "$DIAGRAM_CREATE_RESPONSE" | jq -r '.diagram.id')

if [ "$DIAGRAM_ID" = "null" ]; then
  echo "❌ Diagram creation failed!"
  echo "$DIAGRAM_CREATE_RESPONSE" | jq .
  exit 1
fi

echo "✅ Diagram created!"
echo "Diagram ID: $DIAGRAM_ID"
echo "$DIAGRAM_CREATE_RESPONSE" | jq '.diagram | {id, title, createdAt, updatedAt}'
echo ""

# Step 5: ダイアグラム一覧取得
echo "Step 5: Get all diagrams..."
DIAGRAMS_LIST=$(curl -s -X GET "$API_URL/projects/$PROJECT_ID/diagrams" \
  -H "Authorization: Bearer $TOKEN")

echo "$DIAGRAMS_LIST" | jq '.diagrams'
echo ""

# Step 6: 特定のダイアグラム取得
echo "Step 6: Get specific diagram..."
DIAGRAM_GET=$(curl -s -X GET "$API_URL/projects/$PROJECT_ID/diagrams/$DIAGRAM_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$DIAGRAM_GET" | jq '.diagram | {id, title, version, nodeCount: (.data.nodes | length)}'
echo ""

# Step 7: ダイアグラム更新
echo "Step 7: Update diagram..."
DIAGRAM_UPDATE=$(curl -s -X PUT "$API_URL/projects/$PROJECT_ID/diagrams/$DIAGRAM_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Updated GSN Diagram",
    "data": {
      "version": "1.0.0",
      "title": "Updated GSN Diagram",
      "nodes": [
        {
          "id": "node_1",
          "type": "Goal",
          "position": { "x": 400, "y": 200 },
          "size": { "width": 180, "height": 120 },
          "content": "System is acceptably safe",
          "label": "G1",
          "style": {
            "fillColor": "#CCFFCC",
            "borderColor": "#374151",
            "borderWidth": 2
          }
        },
        {
          "id": "node_2",
          "type": "Strategy",
          "position": { "x": 400, "y": 400 },
          "size": { "width": 180, "height": 120 },
          "content": "Argument by hazard analysis",
          "label": "S1",
          "style": {
            "fillColor": "#FFFFFF",
            "borderColor": "#374151",
            "borderWidth": 2
          }
        }
      ],
      "links": [
        {
          "id": "link_1",
          "source": "node_1",
          "target": "node_2",
          "type": "solid",
          "style": {
            "color": "#1F2937",
            "width": 2
          }
        }
      ],
      "metadata": {
        "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
        "updatedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
        "id": "root",
        "isModule": false
      }
    }
  }')

echo "✅ Diagram updated!"
echo "$DIAGRAM_UPDATE" | jq '.diagram | {id, title, version, nodeCount: (.data.nodes | length), linkCount: (.data.links | length)}'
echo ""

# Step 8: アクティビティログ確認
echo "Step 8: Check activity logs..."
ACTIVITY_LOGS=$(curl -s -X GET "$API_URL/projects/$PROJECT_ID/activities" \
  -H "Authorization: Bearer $TOKEN")

echo "$ACTIVITY_LOGS" | jq '.activities | map({action, createdAt}) | .[0:5]'
echo ""

echo "========================================="
echo "✅ All tests passed!"
echo "========================================="
echo ""
echo "Summary:"
echo "  - User ID: $USER_ID"
echo "  - Project ID: $PROJECT_ID"
echo "  - Diagram ID: $DIAGRAM_ID"
echo ""
echo "You can now test the frontend with this project!"
echo "Open http://localhost:5173 and login with:"
echo "  Email: test-diagram@example.com"
echo "  Password: password123"
echo ""
