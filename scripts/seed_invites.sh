
# cd backend
# reset database
# npm run seed


#   - --count=20：通用码
#   - --plan=hku=10,cuhk=10：学校定向码

npm run invites:db -- generate \
    --plan=hku=10,cuhk=10,hkust=10 \
    --batch=beta-001 \
    --note="first beta batch"

# # check codes
# npm run invites:db -- list
# #  按学校筛：
# npm run invites:db -- list --universityId=hku
# # 按批次筛：
# npm run invites:db -- list --batch=beta-001

#  # 手动标记已用

# npm run invites:db -- mark-used \
#     --code=DOPAMINE-HKU-XXXX-YYYY \
#     --userId=some-user-id

#   # 如果只是运营上占用，不对应真实用户：

# npm run invites:db -- mark-used \
#     --code=DOPAMINE-HKU-XXXX-YYYY

#   # 默认会标成 usedBy: "manual-used"。

#   # 手动恢复未使用

# npm run invites:db -- mark-unused \
#     --code=DOPAMINE-HKU-XXXX-YYYY
