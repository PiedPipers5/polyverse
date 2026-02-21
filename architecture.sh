#!/usr/bin/env bash
# ╔═══════════════════════════════════════════════════════════════════════╗
# ║  POLYVERSE — System Architecture TUI Visualizer                     ║
# ║  A creative terminal-based architecture diagram explorer            ║
# ╚═══════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ─── Colors & Styles ─────────────────────────────────────────────────────
RST="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"
ITALIC="\033[3m"
ULINE="\033[4m"
BLINK="\033[5m"

# Foreground
BLK="\033[30m";  RED="\033[31m";  GRN="\033[32m";  YLW="\033[33m"
BLU="\033[34m";  MAG="\033[35m";  CYN="\033[36m";  WHT="\033[37m"

# Bright foreground
BRED="\033[91m"; BGRN="\033[92m"; BYLW="\033[93m"; BBLU="\033[94m"
BMAG="\033[95m"; BCYN="\033[96m"; BWHT="\033[97m"

# Background
BG_BLK="\033[40m";  BG_RED="\033[41m";  BG_GRN="\033[42m"
BG_YLW="\033[43m";  BG_BLU="\033[44m";  BG_MAG="\033[45m"
BG_CYN="\033[46m";  BG_WHT="\033[47m"

# 256 color helpers
fg() { printf "\033[38;5;%sm" "$1"; }
bg() { printf "\033[48;5;%sm" "$1"; }

# ─── Terminal helpers ────────────────────────────────────────────────────
clear_screen() { printf "\033[2J\033[H"; }
move_to() { printf "\033[%d;%dH" "$1" "$2"; }
hide_cursor() { printf "\033[?25l"; }
show_cursor() { printf "\033[?25h"; }
save_cursor() { printf "\033[s"; }
restore_cursor() { printf "\033[u"; }

# Get terminal dimensions
get_term_size() {
    TERM_ROWS=$(tput lines 2>/dev/null || echo 40)
    TERM_COLS=$(tput cols 2>/dev/null || echo 120)
}

# Cleanup on exit
cleanup() {
    show_cursor
    printf "%b" "$RST"
    clear_screen
    echo "Thanks for exploring Polyverse! 🌐"
}
trap cleanup EXIT

# ─── Typing animation ───────────────────────────────────────────────────
typewrite() {
    local text="$1"
    local delay="${2:-0.015}"
    for (( i=0; i<${#text}; i++ )); do
        printf "%s" "${text:$i:1}"
        sleep "$delay"
    done
}

# Fast print with color
cprint() {
    printf "%b" "$1"
}

# Print centered text
center() {
    local text="$1"
    local clean_text
    # Strip ANSI escape sequences to calculate true length
    clean_text=$(printf "%b" "$text" | sed 's/\x1b\[[0-9;]*m//g')
    local len=${#clean_text}
    local pad=$(( (TERM_COLS - len) / 2 ))
    [[ $pad -lt 0 ]] && pad=0
    printf "%*s" "$pad" ""
    printf "%b" "$text"
}

# Draw horizontal line
hline() {
    local char="${1:-─}"
    local color="${2:-$DIM$WHT}"
    local width="${3:-$TERM_COLS}"
    printf "%b" "$color"
    for ((i=0; i<width; i++)); do printf "%s" "$char"; done
    printf "%b\n" "$RST"
}

# Animated progress bar
progress_bar() {
    local label="$1"
    local color="$2"
    local width=40
    printf "  %b%-20s%b [" "$BOLD$WHT" "$label" "$RST"
    for ((i=0; i<width; i++)); do
        printf "%b█%b" "$color" "$RST"
        sleep 0.008
    done
    printf "] %b✓%b\n" "$BGRN" "$RST"
}

# ─── Box drawing ─────────────────────────────────────────────────────────
# draw_box row col width height title [border_color] [fill_color]
draw_box() {
    local row=$1 col=$2 w=$3 h=$4 title="$5"
    local bc="${6:-$CYN}" fc="${7:-}"
    local inner=$((w - 2))

    move_to "$row" "$col"
    printf "%b╭" "$bc"
    for ((i=0; i<inner; i++)); do printf "─"; done
    printf "╮%b" "$RST"

    # Title bar
    if [[ -n "$title" ]]; then
        move_to "$row" $((col + 2))
        printf "%b %b%s%b %b" "$bc" "$BOLD$BWHT" "$title" "$RST" "$bc"
    fi

    for ((r=1; r<h-1; r++)); do
        move_to $((row + r)) "$col"
        printf "%b│%b" "$bc" "$RST"
        if [[ -n "$fc" ]]; then
            printf "%b%*s%b" "$fc" "$inner" "" "$RST"
        else
            printf "%*s" "$inner" ""
        fi
        printf "%b│%b" "$bc" "$RST"
    done

    move_to $((row + h - 1)) "$col"
    printf "%b╰" "$bc"
    for ((i=0; i<inner; i++)); do printf "─"; done
    printf "╯%b" "$RST"
}

# Write text inside a box (relative to box top-left)
box_text() {
    local row=$1 col=$2 text="$3"
    move_to "$row" "$col"
    printf "%b" "$text"
}

# ─── Animated arrow ─────────────────────────────────────────────────────
# draw_varrow from_row col length [color] (vertical arrow going down)
draw_varrow() {
    local from=$1 col=$2 len=$3 color="${4:-$DIM$WHT}"
    for ((r=0; r<len; r++)); do
        move_to $((from + r)) "$col"
        if ((r == len - 1)); then
            printf "%b▼%b" "$color" "$RST"
        else
            printf "%b│%b" "$color" "$RST"
        fi
        sleep 0.01
    done
}

draw_harrow() {
    local row=$1 from_col=$2 len=$3 color="${4:-$DIM$WHT}"
    for ((c=0; c<len; c++)); do
        move_to "$row" $((from_col + c))
        if ((c == len - 1)); then
            printf "%b▶%b" "$color" "$RST"
        else
            printf "%b─%b" "$color" "$RST"
        fi
        sleep 0.008
    done
}

draw_harrow_left() {
    local row=$1 from_col=$2 len=$3 color="${4:-$DIM$WHT}"
    for ((c=len-1; c>=0; c--)); do
        move_to "$row" $((from_col + c))
        if ((c == 0)); then
            printf "%b◀%b" "$color" "$RST"
        else
            printf "%b─%b" "$color" "$RST"
        fi
        sleep 0.008
    done
}

# ─── SCREENS ─────────────────────────────────────────────────────────────

splash_screen() {
    clear_screen
    get_term_size
    hide_cursor

    local logo_start=$(( (TERM_ROWS / 2) - 8 ))

    # Animated starfield background
    local stars=("·" "∙" "⋅" "✦" "✧" "⊹")
    local colors=("$DIM$WHT" "$DIM$CYN" "$DIM$BLU" "$DIM$MAG")
    for ((i=0; i<60; i++)); do
        local sr=$(( RANDOM % TERM_ROWS + 1 ))
        local sc=$(( RANDOM % TERM_COLS + 1 ))
        move_to "$sr" "$sc"
        printf "%b%s%b" "${colors[$((RANDOM % 4))]}" "${stars[$((RANDOM % 6))]}" "$RST"
    done

    # ASCII Art Logo with gradient colors
    local -a logo=(
        "██████╗  ██████╗ ██╗  ██╗   ██╗██╗   ██╗███████╗██████╗ ███████╗███████╗"
        "██╔══██╗██╔═══██╗██║  ╚██╗ ██╔╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝"
        "██████╔╝██║   ██║██║   ╚████╔╝ ██║   ██║█████╗  ██████╔╝███████╗█████╗  "
        "██╔═══╝ ██║   ██║██║    ╚██╔╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝  "
        "██║     ╚██████╔╝███████╗██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗"
        "╚═╝      ╚═════╝ ╚══════╝╚═╝     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝"
    )

    local gradient_colors=(196 202 208 214 220 226)

    for ((l=0; l<${#logo[@]}; l++)); do
        move_to $((logo_start + l)) $(( (TERM_COLS - 72) / 2 ))
        printf "%b%b%s%b" "$(fg "${gradient_colors[$l]}")" "$BOLD" "${logo[$l]}" "$RST"
        sleep 0.06
    done

    # Subtitle
    move_to $((logo_start + 7)) 0
    center "${DIM}${CYN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo

    center "${BOLD}${BWHT}⚡ Federated Social Network — System Architecture Explorer ⚡${RST}"
    echo; echo

    center "${DIM}${WHT}SvelteKit  ·  ActivityPub  ·  Fedify  ·  PostgreSQL  ·  Redis  ·  Vercel${RST}"
    echo; echo; echo

    # Animated loading bars
    local mid=$(( (TERM_COLS - 64) / 2 ))
    move_to $((logo_start + 13)) "$mid"
    progress_bar "Identity Layer" "$(fg 196)"
    move_to $((logo_start + 14)) "$mid"
    progress_bar "Content Engine" "$(fg 208)"
    move_to $((logo_start + 15)) "$mid"
    progress_bar "Federation Core" "$(fg 39)"

    echo; echo
    center "${BLINK}${BYLW}  ▸ Press any key to enter ◂  ${RST}"
    echo

    read -rsn1
}

# ─── MAIN ARCHITECTURE DIAGRAM ──────────────────────────────────────────
main_architecture() {
    clear_screen
    get_term_size
    hide_cursor

    # Title
    move_to 1 0
    center "${BOLD}$(fg 39)╔══════════════════════════════════════════════════════════════╗${RST}"
    echo
    center "${BOLD}$(fg 39)║${RST}  ${BOLD}${BWHT}P O L Y V E R S E  —  S Y S T E M   A R C H I T E C T U R E${RST}  ${BOLD}$(fg 39)║${RST}"
    echo
    center "${BOLD}$(fg 39)╚══════════════════════════════════════════════════════════════╝${RST}"
    echo

    local base_row=5
    local left_margin=4

    # ════════════════════════════════════════════════════════════════
    # LAYER 1: CLIENT / BROWSER
    # ════════════════════════════════════════════════════════════════
    draw_box $base_row $left_margin 112 5 "🌐  CLIENT LAYER  (Browser)" "$(fg 214)" ""
    box_text $((base_row+1)) $((left_margin+3)) "$(fg 214)${BOLD}SvelteKit Frontend${RST}  ${DIM}(SSR + CSR)${RST}"
    box_text $((base_row+2)) $((left_margin+3)) "$(fg 250)┌──────────────┐  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐${RST}"
    box_text $((base_row+3)) $((left_margin+3)) "$(fg 250)│$(fg 214) Registration ${RST}$(fg 250)│  │$(fg 214)  Login Form ${RST}$(fg 250) │  │$(fg 214) Post Composer  ${RST}$(fg 250)│  │$(fg 214) Profile Edit ${RST}$(fg 250)│  │$(fg 214) Search Bar   ${RST}$(fg 250)│${RST}"
    box_text $((base_row+4)) $((left_margin+79)) "$(fg 250)${DIM}Svelte 5 + shadcn-svelte${RST}"

    # Animated arrows
    draw_varrow $((base_row+5)) 30 2 "$(fg 214)"
    draw_varrow $((base_row+5)) 60 2 "$(fg 214)"
    draw_varrow $((base_row+5)) 90 2 "$(fg 214)"

    # ════════════════════════════════════════════════════════════════
    # LAYER 2: API / ROUTING
    # ════════════════════════════════════════════════════════════════
    local api_row=$((base_row + 7))
    draw_box $api_row $left_margin 112 7 "⚙️  SERVER LAYER  (SvelteKit + Fedify)" "$(fg 39)" ""
    box_text $((api_row+1)) $((left_margin+3)) "$(fg 39)${BOLD}API Routes & Middleware${RST}                                           $(fg 39)${BOLD}Federation Engine${RST}"
    box_text $((api_row+2)) $((left_margin+3)) "$(fg 250)┌────────────────────────────────────────────────────┐    ┌──────────────────────────────┐${RST}"
    box_text $((api_row+3)) $((left_margin+3)) "$(fg 250)│ $(fg 81)POST /register${RST}  $(fg 81)POST /login${RST}  $(fg 81)PATCH /api/users/me${RST}    $(fg 250)│    │ $(fg 105)POST /users/:id/inbox${RST}        $(fg 250)│${RST}"
    box_text $((api_row+4)) $((left_margin+3)) "$(fg 250)│ $(fg 81)GET  /users/:id${RST}  $(fg 81)POST /outbox${RST}  $(fg 81)GET /outbox${RST}            $(fg 250)│    │ $(fg 105)POST /inbox (Shared)${RST}         $(fg 250)│${RST}"
    box_text $((api_row+5)) $((left_margin+3)) "$(fg 250)│ $(fg 81)GET  /.well-known/webfinger${RST} $(fg 81)GET /.well-known/did.json${RST} $(fg 250)│    │ $(fg 105)HTTP Signature Verify${RST}       $(fg 250)│${RST}"
    box_text $((api_row+6)) $((left_margin+55)) "$(fg 250)${DIM}JWT Auth Middleware${RST}    ${DIM}Fedify Framework${RST}"

    # Arrows down to services
    draw_varrow $((api_row+7)) 25 2 "$(fg 39)"
    draw_varrow $((api_row+7)) 50 2 "$(fg 39)"
    draw_varrow $((api_row+7)) 75 2 "$(fg 39)"
    draw_varrow $((api_row+7)) 100 2 "$(fg 105)"

    # ════════════════════════════════════════════════════════════════
    # LAYER 3: SERVICES / BUSINESS LOGIC
    # ════════════════════════════════════════════════════════════════
    local svc_row=$((api_row + 9))
    draw_box $svc_row $left_margin 112 7 "🧠  SERVICE LAYER  (Business Logic)" "$(fg 156)" ""
    box_text $((svc_row+1)) $((left_margin+3)) "$(fg 156)${BOLD}Core Services${RST}"

    box_text $((svc_row+2)) $((left_margin+3)) "$(fg 250)┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐${RST}"
    box_text $((svc_row+3)) $((left_margin+3)) "$(fg 250)│$(fg 156) DID:web Gen  ${RST}$(fg 250)│  │$(fg 156) Actor Build  ${RST}$(fg 250)│  │$(fg 156) Auth / JWT   ${RST}$(fg 250)│  │$(fg 156) Delivery Q   ${RST}$(fg 250)│  │$(fg 156) Inbox Proc   ${RST}$(fg 250)│${RST}"
    box_text $((svc_row+4)) $((left_margin+3)) "$(fg 250)│$(fg 245) RSA/Ed25519  ${RST}$(fg 250)│  │$(fg 245) JSON-LD/AP   ${RST}$(fg 250)│  │$(fg 245) bcrypt+JWT   ${RST}$(fg 250)│  │$(fg 245) BullMQ/Redis ${RST}$(fg 250)│  │$(fg 245) Fan-out      ${RST}$(fg 250)│${RST}"
    box_text $((svc_row+5)) $((left_margin+3)) "$(fg 250)└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘${RST}"

    # Arrows to data layer
    draw_varrow $((svc_row+7)) 30 2 "$(fg 156)"
    draw_varrow $((svc_row+7)) 60 2 "$(fg 156)"
    draw_varrow $((svc_row+7)) 90 2 "$(fg 156)"

    # ════════════════════════════════════════════════════════════════
    # LAYER 4: DATA LAYER
    # ════════════════════════════════════════════════════════════════
    local db_row=$((svc_row + 9))
    draw_box $db_row $left_margin 54 6 "🗄️  PostgreSQL (Neon)" "$(fg 81)" ""
    box_text $((db_row+1)) $((left_margin+3)) "$(fg 81)${BOLD}Drizzle ORM${RST}   ${DIM}Schema + Migrations${RST}"
    box_text $((db_row+2)) $((left_margin+3)) "$(fg 250)┌────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐${RST}"
    box_text $((db_row+3)) $((left_margin+3)) "$(fg 250)│$(fg 81) users  ${RST}$(fg 250)│ │$(fg 81) secrets  ${RST}$(fg 250) │ │$(fg 81)activities${RST}$(fg 250) │ │$(fg 81) follows${RST}$(fg 250) │${RST}"
    box_text $((db_row+4)) $((left_margin+3)) "$(fg 250)└────────┘ └──────────┘ └──────────┘ └────────┘${RST}"

    draw_box $db_row $((left_margin+58)) 54 6 "⚡ Redis Cache" "$(fg 196)" ""
    box_text $((db_row+1)) $((left_margin+61)) "$(fg 196)${BOLD}L1 Cache Layer${RST}   ${DIM}ioredis${RST}"
    box_text $((db_row+2)) $((left_margin+61)) "$(fg 250)┌────────────┐ ┌────────────┐ ┌────────────┐${RST}"
    box_text $((db_row+3)) $((left_margin+61)) "$(fg 250)│$(fg 196) Actor Cache${RST}$(fg 250) │ │$(fg 196) Session    ${RST}$(fg 250) │ │$(fg 196) Delivery Q ${RST}$(fg 250)│${RST}"
    box_text $((db_row+4)) $((left_margin+61)) "$(fg 250)└────────────┘ └────────────┘ └────────────┘${RST}"

    # ════════════════════════════════════════════════════════════════
    # EXTERNAL: FEDERATION
    # ════════════════════════════════════════════════════════════════
    local fed_row=$((db_row + 7))
    # Draw federation cloud
    draw_box $fed_row $((left_margin+20)) 72 4 "🌍  FEDIVERSE  (External Federation)" "$(fg 105)" ""
    box_text $((fed_row+1)) $((left_margin+23)) "$(fg 105)Mastodon  ·  Pleroma  ·  Misskey  ·  Lemmy  ·  PeerTube  ·  Any AP Server${RST}"
    box_text $((fed_row+2)) $((left_margin+23)) "$(fg 245)↕ Follow / Create / Delete / Update / Announce / Accept / Undo  (JSON-LD)${RST}"

    # Arrow from API to federation
    draw_varrow $((db_row+6)) 55 2 "$(fg 105)"

    # ════════════════════════════════════════════════════════════════
    # DEVOPS SIDEBAR
    # ════════════════════════════════════════════════════════════════
    local ops_row=$((fed_row + 5))
    move_to $ops_row 0
    hline "━" "$(fg 240)" "$TERM_COLS"

    move_to $((ops_row+1)) $left_margin
    printf "%b%b  🚀 DevOps & CI/CD Pipeline%b" "$BOLD" "$(fg 220)" "$RST"
    move_to $((ops_row+2)) $left_margin
    printf "%b  GitHub Actions → Lint → Type Check → Build → Unit Tests → Migration Check → Vercel Deploy → Smoke Tests%b" "$(fg 250)" "$RST"
    move_to $((ops_row+3)) $left_margin
    printf "%b  CodeQL Security Scanning (weekly) · Dependabot (weekly) · Blob Storage (Vercel) · Resend (email)%b" "$(fg 245)" "$RST"

    # Footer
    move_to $((ops_row+5)) 0
    hline "━" "$(fg 240)" "$TERM_COLS"
    move_to $((ops_row+6)) 0
    center "${BOLD}${BWHT}[1]${RST}${WHT} Epic 1: Identity  ${BOLD}${BWHT}[2]${RST}${WHT} Epic 2: Content  ${BOLD}${BWHT}[3]${RST}${WHT} Epic 3: Federation  ${BOLD}${BWHT}[D]${RST}${WHT} Data Flow  ${BOLD}${BWHT}[Q]${RST}${WHT} Quit${RST}"
    echo
}

# ─── EPIC 1 DETAIL VIEW ─────────────────────────────────────────────────
epic1_view() {
    clear_screen
    get_term_size
    hide_cursor

    move_to 1 0
    center "${BOLD}$(fg 196)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo
    center "${BOLD}$(fg 196)  ⚡ EPIC 1: Foundation — Identity, Actors & Cryptography ⚡  ${RST}"
    echo
    center "${BOLD}$(fg 196)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo

    local row=6
    local m=6

    # DID Generation Flow
    draw_box $row $m 108 3 "1.1  Decentralized Account Creation" "$(fg 196)"
    box_text $((row+1)) $((m+3)) "$(fg 250)User Register → $(fg 196)RSA-2048 / Ed25519 Keygen${RST} → $(fg 196)DID Document (W3C)${RST} → $(fg 81)PostgreSQL (users + secrets)${RST}"

    draw_varrow $((row+3)) 55 2 "$(fg 196)"

    # WebFinger
    row=$((row+5))
    draw_box $row $m 108 3 "1.2  ActivityPub Actor Discovery (WebFinger)" "$(fg 202)"
    box_text $((row+1)) $((m+3)) "$(fg 250)Remote query → $(fg 202)GET /.well-known/webfinger?resource=acct:user@domain${RST} → $(fg 202)JRD Response (rel=self → Actor URL)${RST}"

    draw_varrow $((row+3)) 55 2 "$(fg 202)"

    # Actor Profile
    row=$((row+5))
    draw_box $row $m 108 3 "1.3  The Actor Profile (JSON-LD)" "$(fg 208)"
    box_text $((row+1)) $((m+3)) "$(fg 250)GET /users/:username → $(fg 208)Content Negotiation${RST} → $(fg 208)Actor JSON (inbox, outbox, publicKey)${RST} | $(fg 214)HTML Profile${RST}"

    draw_varrow $((row+3)) 55 2 "$(fg 208)"

    # Auth
    row=$((row+5))
    draw_box $row $m 108 3 "1.4  Secure Authentication" "$(fg 214)"
    box_text $((row+1)) $((m+3)) "$(fg 250)POST /login → $(fg 214)bcrypt/argon2 verify${RST} → $(fg 214)JWT (UUID + DID)${RST} → $(fg 214)HttpOnly Cookie${RST} → $(fg 156)Protected Routes (middleware)${RST}"

    draw_varrow $((row+3)) 55 2 "$(fg 214)"

    # Profile Customization
    row=$((row+5))
    draw_box $row $m 108 3 "1.5  Profile Customization" "$(fg 220)"
    box_text $((row+1)) $((m+3)) "$(fg 250)Avatar Upload → $(fg 220)Vercel Blob Storage${RST} → $(fg 220)PATCH /api/users/me${RST} → $(fg 220)Actor JSON (icon, summary, name)${RST}"

    # Key Architecture Insight
    row=$((row+5))
    move_to $row $m
    printf "%b%b  💡 KEY INSIGHT:%b The DID publicKey is embedded INTO the Actor's publicKey.publicKeyPem field.%b" "$BOLD" "$(fg 226)" "${RST}" "${RST}"
    move_to $((row+1)) $m
    printf "%b     This links W3C Decentralized Identity ↔ ActivityPub Federation Identity — a unique Polyverse design.%b" "$(fg 250)" "$RST"

    # Footer
    row=$((row+3))
    move_to $row 0
    hline "━" "$(fg 240)" "$TERM_COLS"
    move_to $((row+1)) 0
    center "${BOLD}${BWHT}[B]${RST}${WHT} Back to Architecture  ${BOLD}${BWHT}[2]${RST}${WHT} Epic 2  ${BOLD}${BWHT}[3]${RST}${WHT} Epic 3  ${BOLD}${BWHT}[Q]${RST}${WHT} Quit${RST}"
    echo
}

# ─── EPIC 2 DETAIL VIEW ─────────────────────────────────────────────────
epic2_view() {
    clear_screen
    get_term_size
    hide_cursor

    move_to 1 0
    center "${BOLD}$(fg 208)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo
    center "${BOLD}$(fg 208)  📝 EPIC 2: Content Creation & Data Autonomy 📝  ${RST}"
    echo
    center "${BOLD}$(fg 208)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo

    local row=6
    local m=6

    # Create Note
    draw_box $row $m 108 4 "2.1  Publishing a Note" "$(fg 208)"
    box_text $((row+1)) $((m+3)) "$(fg 250)Composer UI → $(fg 208)POST /users/:username/outbox${RST}  →  Generate UUID URI"
    box_text $((row+2)) $((m+3)) "$(fg 250)Backend:     $(fg 208)Note { content, published, attributedTo, to/cc }${RST} wrapped in $(fg 208)Create Activity${RST}"

    draw_varrow $((row+4)) 55 2 "$(fg 208)"

    # Outbox
    row=$((row+6))
    draw_box $row $m 108 4 "2.2  Viewing the Outbox (My Feed)" "$(fg 214)"
    box_text $((row+1)) $((m+3)) "$(fg 250)GET /users/:username/outbox  →  $(fg 214)OrderedCollection${RST}  { totalItems, first → page_url }"
    box_text $((row+2)) $((m+3)) "$(fg 250)Each page:  $(fg 214)OrderedCollectionPage${RST}  { orderedItems: [...Notes], next → older_page }  $(fg 245)(cursor pagination)${RST}"

    draw_varrow $((row+4)) 55 2 "$(fg 214)"

    # Audience Scoping
    row=$((row+6))
    draw_box $row $m 108 5 "2.3  Audience Scoping (Privacy)" "$(fg 220)"
    box_text $((row+1)) $((m+3)) "$(fg 220)${BOLD}Public:${RST}$(fg 250)          to: [as:Public]     cc: [followers]${RST}"
    box_text $((row+2)) $((m+3)) "$(fg 220)${BOLD}Unlisted:${RST}$(fg 250)        to: [followers]      cc: [as:Public]${RST}"
    box_text $((row+3)) $((m+3)) "$(fg 220)${BOLD}Followers Only:${RST}$(fg 250)  to: [followers]      cc: []${RST}"

    draw_varrow $((row+5)) 55 2 "$(fg 220)"

    # Edit & Delete
    row=$((row+7))
    draw_box $row $m 52 4 "2.4  Edit & Delete" "$(fg 226)"
    box_text $((row+1)) $((m+3)) "$(fg 250)Edit  → $(fg 226)Update Activity${RST} → same Note ID"
    box_text $((row+2)) $((m+3)) "$(fg 250)Delete→ $(fg 226)Delete Activity${RST} → $(fg 196)Tombstone (410 Gone)${RST}"

    draw_box $row $((m+56)) 52 4 "2.5  Media Attachments" "$(fg 226)"
    box_text $((row+1)) $((m+59)) "$(fg 250)Upload → $(fg 226)POST /api/media/upload${RST} → S3/Blob"
    box_text $((row+2)) $((m+59)) "$(fg 250)Note.attachment: $(fg 226){ type:Image, url, mediaType }${RST}"

    # Footer
    row=$((row+6))
    move_to $row 0
    hline "━" "$(fg 240)" "$TERM_COLS"
    move_to $((row+1)) 0
    center "${BOLD}${BWHT}[B]${RST}${WHT} Back to Architecture  ${BOLD}${BWHT}[1]${RST}${WHT} Epic 1  ${BOLD}${BWHT}[3]${RST}${WHT} Epic 3  ${BOLD}${BWHT}[Q]${RST}${WHT} Quit${RST}"
    echo
}

# ─── EPIC 3 DETAIL VIEW ─────────────────────────────────────────────────
epic3_view() {
    clear_screen
    get_term_size
    hide_cursor

    move_to 1 0
    center "${BOLD}$(fg 39)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo
    center "${BOLD}$(fg 39)  🌐 EPIC 3: The Network — Federation & Interoperability 🌐  ${RST}"
    echo
    center "${BOLD}$(fg 39)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo

    local row=6
    local m=6

    # Remote Lookup
    draw_box $row $m 108 4 "3.1  Remote User Lookup" "$(fg 39)"
    box_text $((row+1)) $((m+3)) "$(fg 250)Search @user@domain → $(fg 39)WebFinger query to remote${RST} → $(fg 39)Fetch remote Actor JSON${RST}"
    box_text $((row+2)) $((m+3)) "$(fg 250)Cache in $(fg 81)remote_users table${RST}$(fg 250) (TTL: 24h)  ·  $(fg 39)HTTP Signature on GET${RST}$(fg 250) (Secure Mode instances)${RST}"

    draw_varrow $((row+4)) 55 2 "$(fg 39)"

    # Follow Handshake
    row=$((row+6))
    draw_box $row $m 108 6 "3.2  Following Remote Users  (3-Step Handshake)" "$(fg 75)"
    box_text $((row+1)) $((m+3)) "$(fg 75)${BOLD}Step 1:${RST}$(fg 250) Construct Follow Activity { actor: local, object: remote }${RST}"
    box_text $((row+2)) $((m+3)) "$(fg 75)${BOLD}Step 2:${RST}$(fg 250) Push to $(fg 196)Redis delivery_queue${RST}$(fg 250)  →  BullMQ worker signs & POSTs to remote inbox${RST}"
    box_text $((row+3)) $((m+3)) "$(fg 75)${BOLD}Step 3:${RST}$(fg 250) Record in $(fg 81)follows table${RST}$(fg 250) (status: pending)  →  Wait for Accept activity${RST}"
    box_text $((row+4)) $((m+3)) "$(fg 250)UI shows $(fg 214)\"Requested\"${RST}$(fg 250) → on Accept → $(fg 156)\"Following\" ✓${RST}"

    draw_varrow $((row+6)) 55 2 "$(fg 75)"

    # Inbox Processing
    row=$((row+8))
    draw_box $row $m 108 6 "3.3  Inbox Processing  (Incoming Federation)" "$(fg 105)"
    box_text $((row+1)) $((m+3)) "$(fg 105)${BOLD}POST /users/:username/inbox${RST}$(fg 250)  ←  Remote server sends JSON-LD activity${RST}"
    box_text $((row+2)) $((m+3)) "$(fg 250)1. $(fg 105)Verify HTTP Signature${RST}$(fg 250)  2. Dispatch by activity type:${RST}"
    box_text $((row+3)) $((m+3)) "$(fg 250)   $(fg 156)Create${RST}$(fg 250) → validate actor=attributedTo, check follow, save Note${RST}"
    box_text $((row+4)) $((m+3)) "$(fg 250)   $(fg 214)Accept${RST}$(fg 250) → upgrade pending follow to accepted   $(fg 196)Delete${RST}$(fg 250) → Tombstone record${RST}"

    draw_varrow $((row+6)) 30 2 "$(fg 105)"
    draw_varrow $((row+6)) 80 2 "$(fg 105)"

    # Shared Inbox + Timeline
    row=$((row+8))
    draw_box $row $m 52 4 "3.4  Shared Inbox Optimization" "$(fg 141)"
    box_text $((row+1)) $((m+3)) "$(fg 250)POST /inbox $(fg 141)(global)${RST}"
    box_text $((row+2)) $((m+3)) "$(fg 250)Fan-out: 1 msg → N local followers${RST}"

    draw_box $row $((m+56)) 52 4 "3.5  Aggregated Timeline" "$(fg 141)"
    box_text $((row+1)) $((m+59)) "$(fg 250)Merge: own posts + federated posts${RST}"
    box_text $((row+2)) $((m+59)) "$(fg 250)Announce (Boost) + Context Fetching${RST}"

    # Footer
    row=$((row+6))
    move_to $row 0
    hline "━" "$(fg 240)" "$TERM_COLS"
    move_to $((row+1)) 0
    center "${BOLD}${BWHT}[B]${RST}${WHT} Back to Architecture  ${BOLD}${BWHT}[1]${RST}${WHT} Epic 1  ${BOLD}${BWHT}[2]${RST}${WHT} Epic 2  ${BOLD}${BWHT}[Q]${RST}${WHT} Quit${RST}"
    echo
}

# ─── DATA FLOW DIAGRAM ──────────────────────────────────────────────────
data_flow_view() {
    clear_screen
    get_term_size
    hide_cursor

    move_to 1 0
    center "${BOLD}$(fg 156)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo
    center "${BOLD}$(fg 156)  🔀 DATA FLOW: How a Federated Post Travels 🔀  ${RST}"
    echo
    center "${BOLD}$(fg 156)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo

    local row=6
    local m=8

    # Step-by-step animated flow
    move_to $row $m
    printf "%b%b  SCENARIO:%b Alice on Polyverse posts a Note. Bob on Mastodon follows Alice.%b" "$BOLD" "$(fg 226)" "$RST" "$RST"
    row=$((row+2))

    local steps=(
        "$(fg 214)❶  Alice writes a post in the Composer UI${RST}"
        "$(fg 214)   ↓  POST /users/alice/outbox  (JWT-authenticated)${RST}"
        ""
        "$(fg 208)❷  SvelteKit API route receives the content${RST}"
        "$(fg 208)   ↓  Generates UUID → builds Note object → wraps in Create Activity${RST}"
        "$(fg 208)   ↓  Stores in PostgreSQL 'activities' table (JSONB)${RST}"
        ""
        "$(fg 202)❸  Delivery system kicks in${RST}"
        "$(fg 202)   ↓  Query 'follows' table → find all followers (local + remote)${RST}"
        "$(fg 202)   ↓  For each remote follower: push to Redis delivery_queue${RST}"
        ""
        "$(fg 196)❹  BullMQ Worker processes the queue${RST}"
        "$(fg 196)   ↓  Resolve Bob's inbox URL (from cached Actor or re-fetch)${RST}"
        "$(fg 196)   ↓  Sign the request with HTTP Signature (Alice's private key)${RST}"
        "$(fg 196)   ↓  POST Create Activity → Bob's Mastodon inbox${RST}"
        ""
        "$(fg 105)❺  Mastodon receives the Create activity${RST}"
        "$(fg 105)   ↓  Verifies HTTP Signature against Alice's Actor publicKey${RST}"
        "$(fg 105)   ↓  Inserts the Note into Bob's home timeline${RST}"
        ""
        "$(fg 39)❻  Bob sees Alice's post in his Mastodon feed! 🎉${RST}"
        ""
        "$(fg 156)━━━ REVERSE: Bob replies on Mastodon ━━━${RST}"
        ""
        "$(fg 75)❼  Mastodon constructs a Create Activity with Bob's reply Note${RST}"
        "$(fg 75)   ↓  Signs with HTTP Signature → POSTs to Alice's inbox (or Shared Inbox)${RST}"
        ""
        "$(fg 81)❽  Polyverse Inbox handler receives the activity${RST}"
        "$(fg 81)   ↓  Verify HTTP Signature → check Bob is known → save Note${RST}"
        "$(fg 81)   ↓  Fan-out to Alice's timeline (and any local followers of Bob)${RST}"
        ""
        "$(fg 156)❾  Alice sees Bob's reply in her Polyverse timeline! 🌐${RST}"
    )

    for line in "${steps[@]}"; do
        move_to $row $m
        printf "  %b" "$line"
        row=$((row+1))
        sleep 0.04
    done

    # Footer
    row=$((row+2))
    move_to $row 0
    hline "━" "$(fg 240)" "$TERM_COLS"
    move_to $((row+1)) 0
    center "${BOLD}${BWHT}[B]${RST}${WHT} Back to Architecture  ${BOLD}${BWHT}[1]${RST}${WHT} Epic 1  ${BOLD}${BWHT}[2]${RST}${WHT} Epic 2  ${BOLD}${BWHT}[3]${RST}${WHT} Epic 3  ${BOLD}${BWHT}[Q]${RST}${WHT} Quit${RST}"
    echo
}

# ─── MAIN LOOP ───────────────────────────────────────────────────────────
main() {
    splash_screen

    local current="main"
    while true; do
        case "$current" in
            main) main_architecture ;;
            epic1) epic1_view ;;
            epic2) epic2_view ;;
            epic3) epic3_view ;;
            data)  data_flow_view ;;
        esac

        while true; do
            read -rsn1 key
            case "$key" in
                1) current="epic1"; break ;;
                2) current="epic2"; break ;;
                3) current="epic3"; break ;;
                d|D) current="data"; break ;;
                b|B) current="main"; break ;;
                q|Q) exit 0 ;;
            esac
        done
    done
}

main
